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
  CONFIRM_EMAIL_PATH,
  VERIFY_PREFIX,
  accessFor,
  isEmailGateExempt,
  homeFor,
  isRoleScoped,
  isVerifyPath,
  verifyPathFor,
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
    '/terms-accept', '/tester', VERIFY_PREFIX, CHOOSE_ACCOUNT_PATH,
  ]

  // /confirm-email is deliberately NOT protected, and this is the subtle one.
  // With "Confirm email" on, signUp() returns a user and NO session — so the
  // person landing on /confirm-email straight out of signup is anonymous, and
  // protecting the page would bounce them to the landing page at exactly the
  // moment it is supposed to help. The page renders from the ?email query in
  // that state and from the session when there is one. /login, /signup,
  // /forgot-password and /reset-password are absent for the same reason: an
  // anonymous user has to reach all of them.
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

  // Showing a signed-in user a login form is a bug report waiting to happen, so
  // these bounce the same way '/' does. /forgot-password and /reset-password are
  // NOT here: a signed-in user changing their password is doing a legitimate
  // thing.
  const isAuthPage = pathname === '/login' || pathname === '/signup'

  // ── The email-confirmation gate — the first link in the chain ───────────
  //
  // Supabase's email_confirmed_at is the source of truth (no column of ours),
  // and it rides along on the getUser() above, so this costs no extra query and
  // can run before the profile read the terms gate needs.
  //
  // This is the URL-level half; lib/auth.ts re-checks it in-page. Per CLAUDE.md
  // neither layer may be relied on alone.
  //
  // Admins are NOT exempt, unlike the terms gate below. An admin with an
  // unproven address is the same risk as anyone else, and resend is always open.
  if (user && !user.email_confirmed_at) {
    if (!isEmailGateExempt(pathname)) {
      return noStore(NextResponse.redirect(new URL(CONFIRM_EMAIL_PATH, request.url)))
    }
    // On an exempt page: stop here rather than falling into the terms/account
    // chain below, which would redirect them off the very page they need.
    return isProtected ? noStore(response) : response
  }

  // A signed-in user on a gated route (or the homepage, or an auth page) needs
  // their profile and account records to decide where they belong. One embedded
  // read covers both — service-role so RLS on `profiles` / `accounts` can't
  // block it.
  if (
    user &&
    (isProtected || pathname === '/' || isAuthPage || pathname === CONFIRM_EMAIL_PATH)
  ) {
    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: profile } = await admin
      .from('profiles')
      .select('role, accepted_terms_at, accounts(type, verification_completed_at)')
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
      const rows = (profile?.accounts ?? []) as {
        type: AccountType
        verification_completed_at: string | null
      }[]
      const types = rows.map((a) => a.type)
      const preferred = request.cookies.get(ACCOUNT_COOKIE)?.value as AccountType | undefined
      const active =
        preferred && types.includes(preferred)
          ? preferred
          : types.includes('builder')
            ? 'builder'
            : (types[0] ?? null)

      // Read off the account that was actually resolved above, never off the
      // cookie's claim — a verified builder account says nothing about the
      // tester account this request is acting as. Mirrors getActiveAccount().
      const verified = !!rows.find((a) => a.type === active)?.verification_completed_at

      // Confirmed and signed in, so none of these are somewhere to be: the
      // landing page, a login form, or a gate already cleared. Listed here
      // rather than relying on isProtected, since two of them are public.
      if (pathname === '/' || isAuthPage || pathname === CONFIRM_EMAIL_PATH) {
        const target = isAdmin ? '/admin' : active ? homeFor(active) : CHOOSE_ACCOUNT_PATH
        return noStore(NextResponse.redirect(new URL(target, request.url)))
      }

      if (!isAdmin) {
        // Verification gate — the URL-level half of requireAccount()'s check.
        // Same exemption shape as the terms gate above: the page that lifts the
        // gate is the one page the gate must not apply to, or it redirects to
        // itself forever. Runs before accessFor() so an unverified user lands on
        // /verify/[role] in one hop rather than bouncing via their role home.
        // Scoped to role-scoped paths only (see isRoleScoped) so it matches
        // exactly what requireAccount() gates in-page.
        if (active && isRoleScoped(pathname)) {
          const verifyPath = verifyPathFor(active)
          if (!verified && pathname !== verifyPath) {
            return noStore(NextResponse.redirect(new URL(verifyPath, request.url)))
          }
          // Already through the gate: the flow is not somewhere to go back to.
          if (verified && isVerifyPath(pathname)) {
            return noStore(NextResponse.redirect(new URL(homeFor(active), request.url)))
          }
        }

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
