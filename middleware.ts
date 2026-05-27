// This is the Next.js middleware entry point.
// It refreshes the Supabase session on every request and handles
// auth-based redirects (e.g. logged-in users hitting "/" go to /explore)
// and gates the onboarding flow (terms acceptance + onboarding walkthrough).

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set({name, value, ...options})
          )
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session and get user
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Routes that require an authenticated session.
  const protectedPrefixes = ['/dashboard', '/settings', '/admin', '/mission', '/explore', '/terms-accept']
  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  )

  // If user is logged in and trying to access the homepage, redirect to /explore
  // (terms gating below will catch them if they haven't accepted yet)
  if (user && pathname === '/') {
    return NextResponse.redirect(new URL('/explore', request.url))
  }

  // Anonymous users hitting a protected route get bounced to the landing page.
  if (!user && isProtected) {
    const redirectResponse = NextResponse.redirect(new URL('/', request.url))
    // Make sure the redirect itself is never cached so back/forward navigation re-runs auth.
    redirectResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    return redirectResponse
  }

  // Terms gating: authenticated non-admin users must accept terms before reaching the
  // rest of the app. The /terms-accept page itself is exempt to avoid a redirect loop.
  // Admins skip this gate entirely. Uses the service-role client so RLS on `profiles`
  // can't block the read.
  if (user && isProtected && pathname !== '/terms-accept') {
    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: profile } = await admin
      .from('profiles')
      .select('role, accepted_terms_at')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'admin' && !profile?.accepted_terms_at) {
      const redirectResponse = NextResponse.redirect(new URL('/terms-accept', request.url))
      redirectResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      return redirectResponse
    }
  }

  // For authenticated protected routes, disable browser back/forward cache so
  // pressing "back" after sign-out can't reveal the cached dashboard.
  if (isProtected) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
