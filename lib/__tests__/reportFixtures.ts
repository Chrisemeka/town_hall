import type { FeedbackEntry, FeedbackRow } from "@/lib/exportDb"

// Shared by the report model, document and route tests.

export const OWNER = "11111111-1111-4111-8111-111111111111"
/** What a tester is, and what must never appear in a report. */
export const TESTER = { id: "22222222-2222-4222-8222-222222222222", name: "Adaeze Okonkwo", email: "adaeze@example.com" }

const project = { name: "Recipe Book", owner_id: OWNER }
export const DESIGN = { title: "First impressions", created_at: "2026-09-01T00:00:00Z", category: "ui_design", device_target: "both", projects: project }
export const FLOW = { title: "Checkout flow", created_at: "2026-09-05T00:00:00Z", category: "process_flow", device_target: "mobile", projects: project }

export const STEPS = [
  { step_id: "s1", action: "Look at the home page for five seconds", expected: "You can say what the app does" },
  { step_id: "s2", action: "Say who you think this is built for", expected: "Home cooks who plan the week" },
  { step_id: "s3", action: "Find the pricing", expected: "It is one click from the header" },
]

export function entry(i: number, status: string, extra: Partial<FeedbackEntry> = {}): FeedbackEntry {
  return {
    step_id: STEPS[i].step_id,
    step_index: i,
    step_action: STEPS[i].action,
    step_expected: STEPS[i].expected,
    status,
    actual_result: status === "pass" ? "" : `Tester saw something else on step ${i + 1}.`,
    issue_summary: status === "pass" ? null : `Problem on step ${i + 1}`,
    steps_to_reproduce: status === "pass" ? null : "1. Open it. 2. Look.",
    ...extra,
  }
}

/**
 * A report. The joined mission row also carries the tester's name, email and
 * id — as a careless select would — so the anonymity tests prove the report
 * never reaches for them.
 */
export function report(
  id: string,
  createdAt: string,
  entries: FeedbackEntry[],
  extra: Partial<FeedbackRow> = {},
): FeedbackRow {
  return {
    id,
    mission_id: "m-design",
    created_at: createdAt,
    status: "pending",
    rating: null,
    tester_comment: null,
    ai_summary: null,
    ai_sentiment: null,
    screenshot_urls: [],
    screenshot_url: null,
    missions: DESIGN,
    test_result_entries: entries,
    ...extra,
    ...({ tester_id: TESTER.id, profiles: { full_name: TESTER.name, email: TESTER.email } } as object),
  }
}

/** Five testers on the design mission: step 2 is the real problem. */
export const FIVE = [
  report("r1", "2026-10-02T09:00:00.000Z", [entry(0, "pass"), entry(1, "fail"), entry(2, "pass")], {
    status: "approved",
    rating: 4,
    tester_comment: "Lovely colours.",
    ai_summary: "The tester found the audience unclear.",
  }),
  report("r2", "2026-10-03T09:00:00.000Z", [entry(0, "pass"), entry(1, "fail"), entry(2, "blocked")], { status: "approved", rating: 3 }),
  report("r3", "2026-10-04T09:00:00.000Z", [entry(0, "pass"), entry(1, "fail"), entry(2, "pass")]),
  report("r4", "2026-10-05T09:00:00.000Z", [entry(0, "fail"), entry(1, "fail"), entry(2, "pass")]),
  report("r5", "2026-10-11T09:00:00.000Z", [entry(0, "pass"), entry(1, "pass"), entry(2, "pass")]),
]
