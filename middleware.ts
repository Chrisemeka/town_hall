// This is the Next.js middleware entry point.
// It refreshes the Supabase session on every request and handles
// auth-based redirects (e.g. logged-in users hitting "/" go to /explore)
// and gates the onboarding flow (terms acceptance + onboarding walkthrough).

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import {
  ACCOUNT_COOKIE,
  CHOOSE_ACCOUNT_PATH,
  accessFor,
  homeFor,
  type AccountType,
} from '@/lib/access'

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
  const protectedPrefixes = [
    '/dashboard', '/settings', '/admin', '/mission', '/explore',
    '/terms-accept', '/tester', CHOOSE_ACCOUNT_PATH,
  ]
  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  )

  const noStore = (res: NextResponse) => {
    // Make sure the redirect itself is never cached so back/forward navigation re-runs auth.
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    return res
  }

  // Anonymous users hitting a protected route get bounced to the landing page.
  if (!user && isProtected) {
    return noStore(NextResponse.redirect(new URL('/', request.url)))
  }

  // A signed-in user on a gated route (or the homepage) needs their profile and
  // account records to decide where they belong. One embedded read covers both —
  // service-role so RLS on `profiles` / `accounts` can't block it.
  if (user && (isProtected || pathname === '/')) {
    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: profile } = await admin
      .from('profiles')
      .select('role, accepted_terms_at, accounts(type)')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'

    // Terms gating: authenticated non-admin users must accept terms before reaching
    // the rest of the app. The /terms-accept page itself is exempt to avoid a loop.
    if (!isAdmin && !profile?.accepted_terms_at) {
      if (pathname !== '/terms-accept') {
        return noStore(NextResponse.redirect(new URL('/terms-accept', request.url)))
      }
    } else {
      // The cookie is only a preference — intersect it with the accounts that
      // actually exist so a forged value can never widen access. Same resolution
      // order as getActiveAccount() in lib/auth.ts.
      const types = ((profile?.accounts ?? []) as { type: AccountType }[]).map((a) => a.type)
      const preferred = request.cookies.get(ACCOUNT_COOKIE)?.value as AccountType | undefined
      const active =
        preferred && types.includes(preferred)
          ? preferred
          : types.includes('builder')
            ? 'builder'
            : (types[0] ?? null)

      if (pathname === '/') {
        const target = isAdmin ? '/admin' : active ? homeFor(active) : CHOOSE_ACCOUNT_PATH
        return noStore(NextResponse.redirect(new URL(target, request.url)))
      }

      if (!isAdmin) {
        const access = accessFor(pathname, active)
        if (!access.allow) {
          return noStore(NextResponse.redirect(new URL(access.redirect, request.url)))
        }
      }
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
