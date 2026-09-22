// The setup chain's model: which stages exist, where the user is in them, and
// what to tell them at the end.
//
// Kept out of the components for the reason lib/access.ts and lib/review.ts
// are: it is the thing worth testing, and there is no DOM test environment in
// this repo to test a component with.
//
// The state is derived from the GATES, never from a step counter. People do
// not always enter at the top — someone who already holds a builder account
// and later adds a tester role lands straight on /verify/tester, having passed
// terms and the role picker months ago, because middleware routes them to
// whichever gate is unmet. A counter would show "Terms" as pending for
// somebody who accepted them in August. Reading accepted_terms_at, the
// accounts row and verification_completed_at makes mid-chain entry render
// correctly for free.

import type { AccountType } from "@/lib/access"

export type SetupStageId =
  | "terms"
  | "account"
  | "identity"
  | "skills"
  | "review"
  | "done"

export type StageStatus = "done" | "current" | "upcoming"

export type SetupStage = {
  id: SetupStageId
  label: string
  status: StageStatus
}

const LABEL: Record<SetupStageId, string> = {
  terms: "Terms",
  account: "Role",
  identity: "Identity",
  skills: "Skills",
  review: "Review",
  done: "Done",
}

/**
 * The profile portion, per role. Three for a builder, four for a tester.
 *
 * The difference is correct and stays visible — a progress bar that invents a
 * step to look symmetrical is worse than an honest three. Do not pad this.
 */
const PROFILE_STAGES: Record<AccountType, readonly SetupStageId[]> = {
  builder: ["identity", "review", "done"],
  tester: ["identity", "skills", "review", "done"],
}

/** Stages that always exist, whoever you turn out to be. */
const COMMON_STAGES: readonly SetupStageId[] = ["terms", "account"]

/** What the gates say, not where a wizard thinks the user is. */
export type SetupProgress = {
  /** profiles.accepted_terms_at */
  termsAcceptedAt: string | null
  /** The role being set up. Null until the role picker has been answered. */
  role: AccountType | null
  /** Whether an accounts row exists for `role` — or any row, before `role` does. */
  hasAccount: boolean
  /** accounts.verification_completed_at, for `role`. */
  verified: boolean
  /**
   * Which profile sub-step the wizard is showing, when it is on screen.
   * Index into PROFILE_STAGES[role], so the review step is its own index.
   * Omitted on the routes that are not the profile flow.
   */
  profileStep?: number
}

export type SetupBar = {
  stages: SetupStage[]
  /**
   * True when stages exist that cannot be named yet.
   *
   * The role does not exist until the picker is answered, so the profile
   * portion is genuinely unknown before then — and its length differs by role.
   * The indicator renders a trailing marker rather than guessing, because a
   * bar that says "4 steps" and then becomes 3 has lied once already.
   */
  unresolved: boolean
}

/** How many stages the profile portion has for a role. 3 builder, 4 tester. */
export function profileStageCount(role: AccountType): number {
  return PROFILE_STAGES[role].length
}

/**
 * The bar, start to finish, with each stage's status read off the gates.
 *
 * `profileStep` only moves which profile stage is `current`. It can never make
 * an earlier gate look unmet: terms are done if the timestamp is set, whatever
 * page the user is on.
 */
export function setupStages(p: SetupProgress): SetupBar {
  const termsDone = !!p.termsAcceptedAt
  const accountDone = p.hasAccount

  const ids: SetupStageId[] = [
    ...COMMON_STAGES,
    ...(p.role ? PROFILE_STAGES[p.role] : []),
  ]

  // The first stage whose gate is unmet is where the user is — which is the
  // same question middleware answers when it decides where to send them.
  const stages = ids.map((id): SetupStage => {
    let status: StageStatus

    if (id === "terms") {
      status = termsDone ? "done" : "current"
    } else if (id === "account") {
      status = accountDone ? "done" : termsDone ? "current" : "upcoming"
    } else if (!termsDone || !accountDone) {
      // Cannot be current while an earlier gate is still shut.
      status = "upcoming"
    } else if (p.verified) {
      // Through the whole chain: everything but the hand-off is behind them.
      status = id === "done" ? "current" : "done"
    } else {
      const order = PROFILE_STAGES[p.role!]
      const here = p.profileStep ?? 0
      const index = order.indexOf(id)
      status = index < here ? "done" : index === here ? "current" : "upcoming"
    }

    return { id, label: LABEL[id], status }
  })

  return { stages, unresolved: p.role === null }
}

/* ── resume ──────────────────────────────────────────────────────────── */

/**
 * Where to drop someone who left mid-flow: the first step that does not yet
 * hold valid data, or the review step if they all do.
 *
 * `complete` is supplied by the caller rather than imported, so this stays a
 * question about positions and the schemas stay in one place. The caller
 * passes the same per-step schemas the form validates with, so "complete"
 * cannot mean one thing on the way in and another on the way through.
 */
export function firstIncompleteStep(
  role: AccountType,
  complete: (stepIndex: number) => boolean,
): number {
  // The collecting steps are the profile stages minus review and done.
  const collecting = PROFILE_STAGES[role].filter(
    (id) => id !== "review" && id !== "done",
  ).length

  for (let i = 0; i < collecting; i++) {
    if (!complete(i)) return i
  }
  return collecting
}

/* ── the completion screen ───────────────────────────────────────────── */

export type NextStep = { title: string; detail: string }

/**
 * What to do first, once setup is done.
 *
 * Data rather than JSX so it can be asserted without rendering anything, and
 * sourced from /guides/builder and /guides/tester rather than from the
 * reference design — which promises a much larger product than this one has.
 * Nothing here describes a feature that does not exist.
 */
const NEXT_STEPS: Record<AccountType, readonly NextStep[]> = {
  builder: [
    {
      title: "Add your project",
      detail:
        "A name, a URL testers can reach without an invite, a category, and two sentences on what it does.",
    },
    {
      title: "Write a test case",
      detail:
        "Ordered steps — an action to take and what should happen when they take it. Start from a template if one fits.",
    },
    {
      title: "Publish the mission",
      detail:
        "Testers pick it up and work through your steps. Reports come back marked pass, fail or blocked.",
    },
  ],
  tester: [
    {
      title: "Browse open missions",
      detail:
        "Explore lists what builders need tested right now. Pick one that suits the device you have to hand.",
    },
    {
      title: "Read the test case first",
      detail:
        "Every step is an action and what the builder believes should happen. Read them all before you start.",
    },
    {
      title: "File the log as you go",
      detail:
        "Mark each step pass, fail or blocked. A pass needs nothing else; the other two want what happened and how to repeat it.",
    },
  ],
}

export function nextStepsFor(role: AccountType): readonly NextStep[] {
  return NEXT_STEPS[role]
}

/** The one line each role's completion screen leads with. */
export function completionHeadlineFor(role: AccountType): string {
  return role === "tester"
    ? "You're set. Here's how testing works."
    : "You're set. Here's how to get your first report."
}
