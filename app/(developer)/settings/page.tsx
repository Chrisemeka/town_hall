import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountTypesFor } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsClient } from "@/components/settings/SettingsClient";
import { GiveAndTake } from "@/components/settings/GiveAndTake";
import { PlanSection } from "@/components/settings/PlanSection";
import { planIdFor } from "@/lib/vocabulary";
import { tabFromParam } from "@/lib/settingsTabs";
import { reciprocityFrom } from "@/lib/reciprocity";
import { cookies } from "next/headers";
import { THEME_COOKIE, readTheme } from "@/lib/theme";

export const metadata = { title: "Settings — Twnhall" };

export default async function SettingsPage({
  searchParams,
}: {
  // Deep-linkable: /settings?tab=plan opens on Plan, refresh keeps you there,
  // and another surface can point straight at a tab. Anything unrecognised
  // resolves to Profile rather than erroring — see tabFromParam.
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const initialTab = tabFromParam((await searchParams).tab);
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/explore");

  // Service-role read, per the RLS pattern in CLAUDE.md — `profiles` has no
  // policy that would let the anon key see even the caller's own row.
  const theme = readTheme((await cookies()).get(THEME_COOKIE)?.value);

  const admin = createAdminClient();
  const [{ data: profile }, accountTypes, { data: account }, mine, owned, ownProjects] =
    await Promise.all([
    admin
      .from("profiles")
      .select("full_name, country, phone, timezone, bio, skills")
      .eq("id", user.id)
      .maybeSingle(),
    // Resolved on the server: whether to offer the skills field is an account
    // fact, and the client has no business querying for it.
    accountTypesFor(user.id),
    // Which plan the builder account is on. Per-role, so it is read off the
    // accounts row rather than the profile.
    admin
      .from("accounts")
      .select("plan_id")
      .eq("user_id", user.id)
      .eq("type", "builder")
      .maybeSingle(),
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
    // The caller's own projects, for the export scope select.
    admin.from("projects").select("id, name").eq("owner_id", user.id).order("name"),
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
      <div className="mb-8">
        <h1 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-ink">
          Settings
        </h1>
        <p className="font-mono text-[14px] text-ink-muted mt-1">
          Manage your profile and preferences.
        </p>
      </div>

      <SettingsClient
        initialTab={initialTab}
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
        theme={theme}
        projects={(ownProjects.data ?? []) as { id: string; name: string }[]}
        // The count the Activity tab already needed — "feedback received" and
        // "is there anything to export" are the same question.
        hasFeedback={(owned.count ?? 0) > 0}
        activity={
          <GiveAndTake
            stats={stats}
            hasTesterAccount={accountTypes.includes("tester")}
          />
        }
        plan={<PlanSection planId={planIdFor(account?.plan_id as string | null)} />}
      />

    </div>
  );
}
