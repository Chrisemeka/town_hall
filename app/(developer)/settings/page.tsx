import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/SettingsForm";

export const metadata = { title: "Settings — Townhall" };

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/explore");

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    "";

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
        initialDisplayName={displayName}
      />

    </div>
  );
}
