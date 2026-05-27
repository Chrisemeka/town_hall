import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { BugPlay } from "lucide-react";
import { TermsAcceptForm } from "@/components/TermsAcceptForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Accept Terms — Townhall" };

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
    redirect("/explore");
  }

  const displayName =
    profile?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    "";

  const email = profile?.email ?? user.email ?? "";

  return (
    <div className="min-h-screen bg-bone text-midnight font-mono flex flex-col selection:bg-voltage selection:text-obsidian">

      {/* Nav */}
      <header className="border-b border-midnight/10 bg-bone/85 backdrop-blur-md">
        <div className="max-w-[1128px] mx-auto px-6 h-[60px] flex items-center">
          <div className="flex items-center gap-2">
            <BugPlay className="w-5 h-5 text-midnight" />
            <span className="font-syne font-bold text-[18px] text-midnight">Townhall</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[520px]">

          <p className="font-mono text-[12px] text-forest uppercase tracking-[1.5px] mb-3">
            One last step
          </p>
          <h1 className="font-syne font-bold text-[32px] leading-[40px] tracking-[-0.5px] text-midnight mb-3">
            Accept our terms to continue
          </h1>
          <p className="font-mono text-[14px] leading-7 text-midnight/70 mb-8">
            Before joining the community, please review and accept the Terms of Service and Community Guidelines.
          </p>

          {/* Identity card — who's signing */}
          <div className="bg-white border border-midnight/10 rounded-[12px] p-5 mb-8">
            <p className="font-mono text-[11px] text-forest uppercase tracking-[1px] mb-3">
              Signing in as
            </p>
            <p className="font-mono text-[15px] text-midnight mb-1">
              {displayName || "—"}
            </p>
            <p className="font-mono text-[13px] text-midnight/60">
              {email}
            </p>
          </div>

          <TermsAcceptForm />

          <p className="font-mono text-[12px] text-midnight/60 mt-8 leading-6">
            By continuing you confirm that you have read and accepted Townhall's policies. Your acceptance is recorded against your account.
          </p>

        </div>
      </main>

    </div>
  );
}
