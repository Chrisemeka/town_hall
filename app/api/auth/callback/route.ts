import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CHOOSE_ACCOUNT_PATH, homeFor, type AccountType } from '@/lib/access'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const admin = createAdminClient()

        // Self-heal a missing profile. The `on_auth_user_created` trigger only
        // fires on the first INSERT into auth.users, so a profile deleted after
        // signup is never recreated on subsequent logins — leaving the user
        // orphaned and stuck at the terms gate. `ignoreDuplicates` makes this a
        // no-op when a profile already exists, so we never clobber an existing
        // row's role / accepted_terms_at / edited fields.
        const { error: upsertError } = await admin
          .from('profiles')
          .upsert(
            {
              id: user.id,
              email: user.email,
              full_name:
                (user.user_metadata?.full_name as string | undefined) ??
                (user.user_metadata?.name as string | undefined) ??
                null,
              avatar_url:
                (user.user_metadata?.avatar_url as string | undefined) ??
                (user.user_metadata?.picture as string | undefined) ??
                null,
            },
            { onConflict: 'id', ignoreDuplicates: true },
          )
        if (upsertError) {
          console.error('Failed to ensure profile on login:', upsertError.message)
        }

        const { data: profile } = await admin
          .from('profiles')
          .select('role, accepted_terms_at, full_name, avatar_url, accounts(type)')
          .eq('id', user.id)
          .maybeSingle()

        // Backfill the columns the upsert above could not reach.
        //
        // `ignoreDuplicates: true` makes that upsert a no-op for an existing
        // row — correct, because it must never clobber an edited name or an
        // accepted-terms timestamp. But the row usually already exists by the
        // time we get here: Supabase's on_auth_user_created trigger fires on
        // the INSERT into auth.users, which for an email/password signup
        // happens at signUp() time, long before the confirmation link is
        // clicked. So a name passed through user_metadata at signup would
        // otherwise never land.
        //
        // Only NULL columns are written, and only from metadata that exists —
        // so this fills a gap and can never overwrite something the user set.
        // It also fixes a case that predates email signup: a Google sign-in on
        // a profile created some other way never backfilled the avatar.
        if (profile) {
          const metaName =
            (user.user_metadata?.full_name as string | undefined) ??
            (user.user_metadata?.name as string | undefined)
          const metaAvatar =
            (user.user_metadata?.avatar_url as string | undefined) ??
            (user.user_metadata?.picture as string | undefined)

          const backfill: { full_name?: string; avatar_url?: string } = {}
          if (!profile.full_name && metaName) backfill.full_name = metaName
          if (!profile.avatar_url && metaAvatar) backfill.avatar_url = metaAvatar

          if (Object.keys(backfill).length > 0) {
            const { error: backfillError } = await admin
              .from('profiles')
              .update(backfill)
              .eq('id', user.id)
            if (backfillError) {
              console.error('Failed to backfill profile:', backfillError.message)
            }
          }
        }

        // Admins skip the terms gate and go straight to their dashboard.
        if (profile?.role === 'admin') {
          return NextResponse.redirect(`${origin}/admin`)
        }

        // Non-admin: new (or terms-pending) users must accept terms first.
        if (!profile?.accepted_terms_at) {
          return NextResponse.redirect(`${origin}/terms-accept`)
        }

        // Then they need an account type. Post-auth redirect depends on which
        // one they hold — there is no single landing page any more.
        const types = ((profile?.accounts ?? []) as { type: AccountType }[]).map((a) => a.type)
        if (types.length === 0) {
          return NextResponse.redirect(`${origin}${CHOOSE_ACCOUNT_PATH}`)
        }

        // `next` is only honoured when it's reachable from the resolved account;
        // middleware would bounce it otherwise, so resolve it here instead.
        const active: AccountType = types.includes('builder') ? 'builder' : types[0]
        return NextResponse.redirect(`${origin}${next ?? homeFor(active)}`)
      }

      return NextResponse.redirect(`${origin}${next ?? '/'}`)
    }
  }

  // ponytail: no /auth/auth-code-error page exists — bounce to the landing page
  // with a flag instead of a 404. Add a real error page when the copy matters.
  return NextResponse.redirect(`${origin}/?error=auth`)
}
