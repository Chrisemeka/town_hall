import { describe, expect, it } from "vitest"
import { initials } from "@/lib/initials"

// This is what every email/password user's avatar is, so the edge cases are not
// hypothetical: avatar_url is null for all of them by design.
describe("initials", () => {
  it("takes the first two words of a name", () => {
    expect(initials("Ada Lovelace", "ada@twnhall.com")).toBe("AL")
  })

  it("stops at two, however many names there are", () => {
    expect(initials("Ada Byron King Lovelace", null)).toBe("AB")
  })

  it("handles a one-word name", () => {
    expect(initials("Ada", null)).toBe("A")
  })

  it("falls back to the email when there is no name", () => {
    expect(initials(null, "ada@twnhall.com")).toBe("AT")
    expect(initials("", "ada@twnhall.com")).toBe("AT")
  })

  it("splits an address on the dot too, not just the @", () => {
    // Otherwise every gmail address collapses to the same single letter.
    expect(initials(null, "ada.lovelace@gmail.com")).toBe("AL")
  })

  it("uppercases whatever it finds", () => {
    expect(initials("ada lovelace", null)).toBe("AL")
  })

  it("ignores surrounding and repeated separators", () => {
    expect(initials("  Ada   Lovelace  ", null)).toBe("AL")
  })

  it("returns empty rather than throwing when there is nothing to use", () => {
    // An empty circle is honest — we do not know who this is. A throw here
    // would take down every page that renders a list of people.
    expect(initials(null, null)).toBe("")
    expect(initials(undefined, undefined)).toBe("")
    expect(initials("   ", "")).toBe("")
  })
})
