import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountTypesFor } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/SettingsForm";

export const metadata = { title: "Settings — Twnhall" };

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/explore");

  // Service-role read, per the RLS pattern in CLAUDE.md — `profiles` has no
  // policy that would let the anon key see even the caller's own row.
  const admin = createAdminClient();
  const [{ data: profile }, accountTypes] = await Promise.all([
    admin
      .from("profiles")
      .select("full_name, country, phone, timezone, bio, skills")
      .eq("id", user.id)
      .maybeSingle(),
    // Resolved on the server: whether to offer the skills field is an account
    // fact, and the client has no business querying for it.
    accountTypesFor(user.id),
  ]);

  return (
    <div className="max-w-[640px] mx-auto px-6 py-10">

      {/* Page header */}
      <div className="mb-10">
        <h1 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-chalk">
          Settings
        </h1>
        <p className="font-mono text-[14px] text-ash mt-1">
          Manage your profile and preferences.
        </p>
      </div>

      <SettingsForm
        initialEmail={user.email ?? ""}
        initialProfile={{
          full_name: profile?.full_name ?? "",
          country: profile?.country ?? "",
          phone: profile?.phone ?? "",
          timezone: profile?.timezone ?? "",
          bio: profile?.bio ?? "",
          skills: profile?.skills ?? [],
        }}
        hasTesterAccount={accountTypes.includes("tester")}
      />

    </div>
  );
}
