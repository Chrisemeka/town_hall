import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/explore'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const admin = createAdminClient()
        const { data: profile } = await admin
          .from('profiles')
          .select('role, accepted_terms_at, completed_onboarding_at')
          .eq('id', user.id)
          .maybeSingle()

        // Admins skip the onboarding flow and go straight to their dashboard.
        if (profile?.role === 'admin') {
          return NextResponse.redirect(`${origin}/admin`)
        }

        // Non-admin: new (or terms-pending) users go through the onboarding flow first.
        if (!profile?.accepted_terms_at) {
          return NextResponse.redirect(`${origin}/terms-accept`)
        }

        if (!profile?.completed_onboarding_at) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
