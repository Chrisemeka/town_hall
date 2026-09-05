import { describe, expect, it } from "vitest"
import { countSentences } from "@/lib/sentences"

describe("countSentences", () => {
  it("counts text with no terminator as one sentence", () => {
    // The whole reason this is max(1, …). Four of the ten projects live when
    // this shipped were written exactly like this, and they are summaries, not
    // fragments — rejecting them would punish the terse answer the rule wants.
    expect(countSentences("HR ERP")).toBe(1)
    expect(countSentences("Siwes placement platform")).toBe(1)
    expect(
      countSentences(
        "End-to-end whatsapp automation platform for businesses + an ecommerce store that lives entirely on whatsapp",
      ),
    ).toBe(1)
  })

  it("counts a normal two-sentence summary", () => {
    expect(countSentences("Does one thing. Does it well.")).toBe(2)
  })

  it("counts a trailing terminator once, not twice", () => {
    expect(countSentences("Only one thing here.")).toBe(1)
  })

  it("counts three sentences, which the schema then rejects", () => {
    expect(countSentences("One. Two. Three.")).toBe(3)
  })

  it("does not count abbreviations as sentence ends", () => {
    expect(countSentences("Built for teams, e.g. agencies and studios.")).toBe(1)
    expect(countSentences("For SMBs, i.e. under 50 staff.")).toBe(1)
    expect(countSentences("Made by Acme Inc. for accountants.")).toBe(1)
  })

  it("does not count decimal points", () => {
    expect(countSentences("Ships v2.0 next week.")).toBe(1)
    expect(countSentences("Runs 3.5x faster than the old one.")).toBe(1)
  })

  it("does not count the dots in a URL", () => {
    expect(countSentences("Docs live at https://example.com/a.b.c for now.")).toBe(1)
    expect(countSentences("See www.example.com to try it.")).toBe(1)
  })

  it("treats empty and whitespace-only input as zero", () => {
    // The schema's own .min(1) reports this with a better message than a
    // sentence rule could, so this returns 0 rather than 1.
    expect(countSentences("")).toBe(0)
    expect(countSentences("   ")).toBe(0)
  })

  it("counts ! and ? as terminators", () => {
    expect(countSentences("Tired of losing dotfiles? We sync them.")).toBe(2)
    expect(countSentences("It just works! Try it.")).toBe(2)
  })
})
