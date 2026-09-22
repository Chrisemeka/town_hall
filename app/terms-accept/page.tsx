import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountTypesFor, getActiveAccount } from "@/lib/auth";
import { CHOOSE_ACCOUNT_PATH, homeFor } from "@/lib/access";
import { redirect } from "next/navigation";
import { SetupCard, SetupShell } from "@/components/setup/SetupShell";
import { StepIndicator } from "@/components/setup/StepIndicator";
import { TermsAcceptForm } from "@/components/TermsAcceptForm";
import { setupStages } from "@/lib/setup";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Accept Terms — Twnhall" };

export default async function TermsAcceptPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email, role, accepted_terms_at")
    .eq("id", user.id)
    .maybeSingle();

  // Admins don't go through the terms-acceptance flow.
  if (profile?.role === "admin") {
    redirect("/admin");
  }

  if (profile?.accepted_terms_at) {
    const resolved = await getActiveAccount();
    redirect(resolved?.active ? homeFor(resolved.active) : CHOOSE_ACCOUNT_PATH);
  }

  const displayName =
    profile?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    "";

  const email = profile?.email ?? user.email ?? "";

  // Read rather than assumed. Almost everyone here has no account yet, but the
  // bar reports what the gates say — see lib/setup.ts on why it is never a
  // step counter.
  const held = await accountTypesFor(user.id);
  const bar = setupStages({
    termsAcceptedAt: profile?.accepted_terms_at ?? null,
    role: null,
    hasAccount: held.length > 0,
    verified: false,
  });

  return (
    <SetupShell
      context="Setting up your account"
      indicator={<StepIndicator bar={bar} />}
    >
      <SetupCard
        title="Accept our terms to continue"
        subhead="Have a read of the Terms of Service and the Guides, then tick the box below."
      >
        <div className="rounded-[12px] border border-line p-5 mb-8">
          <p className="font-mono text-[12px] text-ink-muted uppercase tracking-[1px] mb-3">
            Signing in as
          </p>
          <p className="font-mono text-[15px] text-ink mb-1">{displayName || "—"}</p>
          <p className="font-mono text-[13px] text-ink-muted">{email}</p>
        </div>

        <TermsAcceptForm />

        <p className="font-mono text-[12px] text-ink-muted mt-8 leading-6">
          Your acceptance is recorded against your account.
        </p>
      </SetupCard>
    </SetupShell>
  );
}
