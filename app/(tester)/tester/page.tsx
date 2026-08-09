import Link from "next/link"
import { Compass, LineChart, UserCog } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireAccount } from "@/lib/auth"
import { averageRating, earningsFrom, isNewMission } from "@/lib/tester"
import { screenshotList } from "@/lib/utils/screenshots"
import { one } from "@/lib/utils/project"
import type { SubmissionStatus } from "@/lib/review"
import { MissionStrip, type StripMission } from "@/components/tester/MissionStrip"
import { SubmissionsFeed, type FeedSubmission } from "@/components/tester/SubmissionsFeed"
import { ProfilePanel } from "@/components/tester/ProfilePanel"

export const metadata = { title: "Tester Home — Twnhall" }

/* Shapes of the two embedded reads below. Supabase isn't typed in this project,
   so these are the contract between the query strings and the mapping code. */
type Embed<T> = T | T[] | null

type SubmissionRow = {
  id: string
  created_at: string
  status: string | null
  rating: number | null
  review_note: string | null
  screenshot_url: string | null
  screenshot_urls: string[] | null
  mission_id: string
  missions: Embed<{
    title: string
    payout_cents: number | null
    projects: Embed<{ name: string }>
  }>
}

type MissionRow = {
  id: string
  title: string
  created_at: string
  payout_cents: number | null
  category: string | null
  load_test_at: string | null
  testers_needed: number | null
  projects: Embed<{ name: string; owner_id: string; flagged_at: string | null }>
}

const STRIP_LIMIT = 6

const QUICK_ACTIONS = [
  { label: "Browse Missions", href: "/explore/missions", icon: Compass, primary: true },
  { label: "Earnings History", href: "#earnings", icon: LineChart, primary: false },
  { label: "Update Profile", href: "/settings", icon: UserCog, primary: false },
]

export default async function TesterHomePage() {
  const { userId } = await requireAccount("tester")
  const supabase = await createClient()

  const [{ data: rawSubs }, { data: rawMissions }] = await Promise.all([
    // Readable thanks to the "testers read own submissions" RLS policy — before
    // that migration this returns nothing and the feed renders empty.
    supabase
      .from("test_results")
      .select(`
        id, created_at, status, rating, review_note, screenshot_url, screenshot_urls, mission_id,
        missions ( title, payout_cents, projects ( name ) )
      `)
      .eq("tester_id", userId)
      .order("created_at", { ascending: false }),

    supabase
      .from("missions")
      .select(`
        id, title, created_at, payout_cents, category, load_test_at, testers_needed,
        projects ( name, owner_id, flagged_at )
      `)
      .order("created_at", { ascending: false }),
  ])

  /* ── My Submissions ─────────────────────────────────────────────────── */

  const subRows = (rawSubs ?? []) as unknown as SubmissionRow[]

  const submissions: FeedSubmission[] = subRows.map((r) => {
    const mission = one(r.missions)
    const project = one(mission?.projects)
    return {
      id: r.id,
      missionId: r.mission_id,
      missionTitle: mission?.title ?? "Untitled mission",
      projectName: project?.name ?? "Unknown project",
      status: (r.status ?? "pending") as SubmissionStatus,
      createdAt: r.created_at,
      payoutCents: mission?.payout_cents ?? 0,
      screenshots: screenshotList(r),
      reviewNote: r.review_note ?? null,
    }
  })

  /* ── Earnings & reputation — all derived off the feed ───────────────── */

  const earnings = earningsFrom(submissions.map((s) => ({ status: s.status, payout_cents: s.payoutCents })))
  const avgRating = averageRating(subRows.map((r) => r.rating ?? null))

  /* ── New missions strip ─────────────────────────────────────────────── */

  const submittedMissionIds = new Set(submissions.map((s) => s.missionId))

  const missions: StripMission[] = ((rawMissions ?? []) as unknown as MissionRow[])
    .filter((m) => {
      const project = one(m.projects)
      if (!project || project.flagged_at) return false
      // The same person may hold a Builder account too — they still can't test
      // their own project, same rule the submission action enforces.
      if (project.owner_id === userId) return false
      return !submittedMissionIds.has(m.id)
    })
    .slice(0, STRIP_LIMIT)
    .map((m) => {
      const project = one(m.projects)
      return {
        id: m.id,
        title: m.title,
        projectName: project?.name ?? "Unknown project",
        category: m.category ?? null,
        payoutCents: m.payout_cents ?? 0,
        isNew: isNewMission(m.created_at),
        loadTestAt: m.load_test_at ?? null,
        testersNeeded: m.testers_needed ?? null,
        createdAt: m.created_at,
      }
    })

  const newCount = missions.filter((m) => m.isNew).length

  return (
    <div className="max-w-[1128px] mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-10 flex flex-col gap-8">

      {/* Header + Quick Actions */}
      <div id="tour-tester-header" className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div>
          <h1 className="font-syne font-bold text-[28px] leading-[34px] sm:text-[32px] sm:leading-[40px] md:text-[36px] md:leading-[44px] tracking-[-0.5px] text-chalk">
            Tester Home
          </h1>
          <p className="font-mono text-[14px] text-ash mt-1">
            {missions.length > 0
              ? `${missions.length} open mission${missions.length !== 1 ? "s" : ""} waiting for you.`
              : "Nothing open right now — check back soon."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {QUICK_ACTIONS.map(({ label, href, icon: Icon, primary }) => (
            <Link
              key={label}
              href={href}
              className={[
                "h-10 px-4 rounded-[8px] font-mono font-medium text-[13px] flex items-center gap-2 transition-colors duration-150",
                primary
                  ? "bg-voltage text-obsidian hover:bg-voltage-dark"
                  : "bg-graphite border border-iron text-chalk hover:border-voltage hover:text-voltage",
              ].join(" ")}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Zone 1 — New Missions strip */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <p className="font-mono text-[11px] font-medium text-ash uppercase tracking-[1px]">
              New Missions
            </p>
            {newCount > 0 && (
              <span className="font-mono text-[11px] text-voltage bg-voltage/10 px-2 py-0.5 rounded-[6px]">
                {newCount} NEW
              </span>
            )}
          </div>
          <Link
            href="/explore/missions"
            className="font-mono text-[13px] text-ash hover:text-voltage transition-colors duration-150"
          >
            See all →
          </Link>
        </div>
        <MissionStrip missions={missions} />
      </section>

      {/* Zones 2 + 3 — Submissions feed alongside earnings/reputation */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <SubmissionsFeed submissions={submissions} />
        <div id="earnings" className="scroll-mt-20">
          <ProfilePanel
            earnings={earnings}
            avgRating={avgRating}
            signals={[
              // Google is the only auth provider, so a session means a verified
              // Google email. The rest have no backing feature yet and render
              // as unearned prompts, exactly as the mockup shows them.
              { label: "Email verified", earned: true },
              { label: "Add payout method", earned: false },
            ]}
          />
        </div>
      </div>

    </div>
  )
}
