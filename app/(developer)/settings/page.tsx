import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountTypesFor } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/SettingsForm";
import { GiveAndTake } from "@/components/settings/GiveAndTake";
import { reciprocityFrom } from "@/lib/reciprocity";
import { ThemePreference } from "@/components/ThemePreference";
import { cookies } from "next/headers";
import { THEME_COOKIE, readTheme } from "@/lib/theme";

export const metadata = { title: "Settings — Twnhall" };

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/explore");

  // Service-role read, per the RLS pattern in CLAUDE.md — `profiles` has no
  // policy that would let the anon key see even the caller's own row.
  const theme = readTheme((await cookies()).get(THEME_COOKIE)?.value);

  const admin = createAdminClient();
  const [{ data: profile }, accountTypes, mine, owned] = await Promise.all([
    admin
      .from("profiles")
      .select("full_name, country, phone, timezone, bio, skills")
      .eq("id", user.id)
      .maybeSingle(),
    // Resolved on the server: whether to offer the skills field is an account
    // fact, and the client has no business querying for it.
    accountTypesFor(user.id),
    // What this person has given: their own submissions, with the ratings the
    // average needs and the statuses the approved count needs.
    admin.from("test_results").select("status, rating").eq("tester_id", user.id),
    // What they have taken: submissions on missions belonging to projects they
    // own. The inner join IS the ownership filter — service role bypasses RLS,
    // so this is the only thing scoping it (CLAUDE.md, Data Mutations).
    //
    // head + exact count: the number is all this needs, so no rows cross the
    // wire. The two-hop embed relies on the FK chain
    // test_results -> missions -> projects being visible to PostgREST.
    admin
      .from("test_results")
      .select("id, missions!inner(projects!inner(owner_id))", {
        count: "exact",
        head: true,
      })
      .eq("missions.projects.owner_id", user.id),
  ]);

  const givenRows = (mine.data ?? []) as { status: string; rating: number | null }[];
  const stats = reciprocityFrom({
    given: givenRows.length,
    received: owned.count ?? 0,
    approved: givenRows.filter((r) => r.status === "approved").length,
    ratings: givenRows.map((r) => r.rating),
  });

  return (
    <div className="max-w-[640px] mx-auto px-6 py-10">

      {/* Page header */}
      <div className="mb-10">
        <h1 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-ink">
          Settings
        </h1>
        <p className="font-mono text-[14px] text-ink-muted mt-1">
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

      <div className="mt-10 flex flex-col gap-10">
        <GiveAndTake
          stats={stats}
          hasTesterAccount={accountTypes.includes("tester")}
        />
        <ThemePreference theme={theme} />
      </div>

    </div>
  );
}
