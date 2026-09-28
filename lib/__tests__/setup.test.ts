import { describe, expect, it } from "vitest"
import {
  completionHeadlineFor,
  firstIncompleteStep,
  nextStepsFor,
  profileStageCount,
  roleCardState,
  setupStages,
  type SetupProgress,
} from "@/lib/setup"

// Vitest rather than a scripts/*.test.mts: this module imports through the
// "@/..." alias, which node's type stripper cannot resolve and vitest.config
// already maps.

const AUGUST = "2026-08-16T10:00:00.000Z"

const at = (p: Partial<SetupProgress>): SetupProgress => ({
  termsAcceptedAt: null,
  role: null,
  hasAccount: false,
  verified: false,
  ...p,
})

const ids = (p: SetupProgress) => setupStages(p).stages.map((s) => s.id)
const statuses = (p: SetupProgress) =>
  Object.fromEntries(setupStages(p).stages.map((s) => [s.id, s.status]))

describe("the profile portion is 3 for a builder and 4 for a tester", () => {
  // The brief's headline rule. A bar that invents a step to look symmetrical
  // is worse than an honest three.
  it("does not pad the builder flow", () => {
    expect(profileStageCount("builder")).toBe(3)
    expect(profileStageCount("tester")).toBe(4)
  })

  it("puts them after the two common stages", () => {
    expect(ids(at({ role: "builder" }))).toEqual([
      "terms",
      "account",
      "identity",
      "review",
      "done",
    ])
    expect(ids(at({ role: "tester" }))).toEqual([
      "terms",
      "account",
      "identity",
      "skills",
      "review",
      "done",
    ])
  })
})

describe("before the role exists", () => {
  it("names only the stages it knows and says so", () => {
    const bar = setupStages(at({ termsAcceptedAt: AUGUST }))
    expect(bar.stages.map((s) => s.id)).toEqual(["terms", "account"])
    // The tail differs by role and is genuinely unknown. A bar that says
    // "4 steps" and then becomes 3 has already lied once.
    expect(bar.unresolved).toBe(true)
  })

  it("stops being unresolved once the role is known", () => {
    expect(setupStages(at({ role: "builder" })).unresolved).toBe(false)
  })
})

describe("status comes from the gates, not from a counter", () => {
  it("marks terms done for someone who accepted them months ago", () => {
    // The case a counter gets wrong: a builder adding a tester role lands
    // straight on /verify/tester, having passed terms and the picker long ago.
    const s = statuses(
      at({
        termsAcceptedAt: AUGUST,
        hasAccount: true,
        role: "tester",
        profileStep: 0,
      }),
    )
    expect(s.terms).toBe("done")
    expect(s.account).toBe("done")
    expect(s.identity).toBe("current")
  })

  it("puts a brand-new user on terms with everything after it upcoming", () => {
    const s = statuses(at({ role: null }))
    expect(s.terms).toBe("current")
    expect(s.account).toBe("upcoming")
  })

  it("moves to the role picker once terms are accepted", () => {
    const s = statuses(at({ termsAcceptedAt: AUGUST }))
    expect(s.terms).toBe("done")
    expect(s.account).toBe("current")
  })

  it("never makes a profile stage current while an earlier gate is shut", () => {
    // profileStep is a wizard position, not an authority. It must not be able
    // to light up a stage the user has not actually reached.
    const s = statuses(at({ role: "tester", profileStep: 2 }))
    expect(s.terms).toBe("current")
    expect(s.identity).toBe("upcoming")
    expect(s.review).toBe("upcoming")
  })
})

describe("inside the profile flow", () => {
  const inFlow = (profileStep: number) =>
    statuses(
      at({
        termsAcceptedAt: AUGUST,
        hasAccount: true,
        role: "tester",
        profileStep,
      }),
    )

  it("tracks the wizard step", () => {
    expect(inFlow(1).identity).toBe("done")
    expect(inFlow(1).skills).toBe("current")
    expect(inFlow(1).review).toBe("upcoming")
  })

  it("reaches review as its own stage", () => {
    expect(inFlow(2).review).toBe("current")
    expect(inFlow(2).done).toBe("upcoming")
  })
})

describe("after verification", () => {
  it("leaves only the hand-off current", () => {
    const s = statuses(
      at({
        termsAcceptedAt: AUGUST,
        hasAccount: true,
        role: "builder",
        verified: true,
      }),
    )
    expect(s.identity).toBe("done")
    expect(s.review).toBe("done")
    expect(s.done).toBe("current")
  })
})

describe("every stage can be rendered", () => {
  it("has a non-empty label", () => {
    // The indicator cannot draw a blank pill.
    for (const role of ["builder", "tester"] as const) {
      for (const stage of setupStages(at({ role })).stages) {
        expect(stage.label.trim().length).toBeGreaterThan(0)
      }
    }
  })
})

describe("firstIncompleteStep", () => {
  // The collecting steps only — review and done collect nothing.
  it("returns the first gap", () => {
    expect(firstIncompleteStep("tester", (i) => i !== 0)).toBe(0)
    expect(firstIncompleteStep("tester", (i) => i !== 1)).toBe(1)
  })

  it("returns the review index when every step is complete", () => {
    expect(firstIncompleteStep("tester", () => true)).toBe(2)
    expect(firstIncompleteStep("builder", () => true)).toBe(1)
  })

  it("resumes a partly-filled profile at the gap, not at the start", () => {
    // Someone who filled identity and closed the tab comes back to skills.
    expect(firstIncompleteStep("tester", (i) => i === 0)).toBe(1)
  })

  it("sends an empty profile to the first step", () => {
    expect(firstIncompleteStep("builder", () => false)).toBe(0)
    expect(firstIncompleteStep("tester", () => false)).toBe(0)
  })
})

describe("completion content", () => {
  it("gives three next steps per role", () => {
    expect(nextStepsFor("builder")).toHaveLength(3)
    expect(nextStepsFor("tester")).toHaveLength(3)
  })

  it("differs by role", () => {
    expect(nextStepsFor("builder")).not.toEqual(nextStepsFor("tester"))
    expect(completionHeadlineFor("builder")).not.toEqual(
      completionHeadlineFor("tester"),
    )
  })

  it("says nothing that is not built", () => {
    // Same rule as the homepage and the pricing page: no tier limits stated as
    // enforced, no video feedback, no guaranteed turnaround, no paid missions.
    const all = (["builder", "tester"] as const)
      .flatMap((r) => nextStepsFor(r).map((s) => `${s.title} ${s.detail}`))
      .join(" ")
      .toLowerCase()
    for (const forbidden of [
      "video",
      "within 24",
      "guaranteed",
      "per month",
      "paid",
      "earn money",
      "unlimited",
    ]) {
      expect(all).not.toContain(forbidden)
    }
  })

  it("has non-empty copy throughout", () => {
    for (const role of ["builder", "tester"] as const) {
      for (const step of nextStepsFor(role)) {
        expect(step.title.trim().length).toBeGreaterThan(0)
        expect(step.detail.trim().length).toBeGreaterThan(0)
      }
    }
  })
})

describe("roleCardState", () => {
  it("leaves both cards live with their idle labels when nothing is pending", () => {
    expect(roleCardState("builder", false, null)).toEqual({ label: "Create this account", disabled: false, busy: false })
    expect(roleCardState("tester", true, null)).toEqual({ label: "Continue", disabled: false, busy: false })
  })

  it("locks BOTH cards on a submit and labels only the tapped one", () => {
    // Tap Builder, see nothing, tap Tester: without the lock that creates both.
    expect(roleCardState("builder", false, "builder")).toEqual({ label: "Creating…", disabled: true, busy: true })
    expect(roleCardState("tester", false, "builder")).toEqual({ label: "Create this account", disabled: true, busy: false })
  })

  it("says Switching… for a role already held", () => {
    expect(roleCardState("tester", true, "tester").label).toBe("Switching…")
  })
})
