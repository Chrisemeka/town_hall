// This is the Next.js middleware entry point.
// It refreshes the Supabase session on every request and handles
// auth-based redirects (e.g. logged-in users hitting "/" go to /explore)

import { createServerClient } from '@supabase/ssr'
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
  const protectedPrefixes = ['/dashboard', '/settings', '/admin', '/mission', '/explore']
  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  )

  // If user is logged in and trying to access the homepage, redirect to /explore
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
