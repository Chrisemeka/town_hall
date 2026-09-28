import { describe, expect, it } from "vitest"
import { accountSwitchCopy } from "@/lib/accountSwitch"

describe("accountSwitchCopy", () => {
  it("offers the other role's switch, never the active one", () => {
    // The reported bug: a tester was offered "Switch to tester account".
    expect(accountSwitchCopy("tester", true).label).toBe("Switch to builder account")
    expect(accountSwitchCopy("builder", true).label).toBe("Switch to tester account")
  })

  it("offers to add the other role when it is not held", () => {
    expect(accountSwitchCopy("tester", false).label).toBe("Add builder account")
    expect(accountSwitchCopy("builder", false).label).toBe("Add tester account")
    expect(accountSwitchCopy("tester", false).heading).toBe("Builder account")
    expect(accountSwitchCopy("builder", false).heading).toBe("Tester account")
  })

  it("keeps the builder-side add copy verbatim", () => {
    expect(accountSwitchCopy("builder", false).body).toBe(
      "Testing someone else's product is how you earn reports on your own. You'll complete a short tester profile first — a few fields and your skills.",
    )
  })

  it("writes the tester-side add copy from the tester's position", () => {
    const body = accountSwitchCopy("tester", false).body
    expect(body).not.toMatch(/earn reports/)
    expect(body).toMatch(/project/)
    expect(body).toMatch(/test case/)
  })

  it("uses the same role-neutral 'you hold both' copy from either side", () => {
    expect(accountSwitchCopy("builder", true).body).toBe(accountSwitchCopy("tester", true).body)
    expect(accountSwitchCopy("tester", true).body).toMatch(/^You hold both\./)
  })
})
