import { describe, expect, it } from "vitest"
import { addSkill, removeSkill, suggestionsFor } from "@/lib/skills"
import { SKILLS_MAX } from "@/lib/vocabulary"

/** A list already at the maximum, built from custom tags so nothing collides. */
const FULL_LIST = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]

describe("addSkill", () => {
  it("adds a canonical skill picked from the suggestions", () => {
    expect(addSkill([], "Frontend")).toEqual({ skills: ["Frontend"], error: null })
  })

  it("adds a custom skill the vocabulary does not have", () => {
    expect(addSkill(["QA"], "Rust")).toEqual({ skills: ["QA", "Rust"], error: null })
  })

  it("stores the canonical spelling when a typed value matches the vocabulary", () => {
    // Typing "frontend" is the same act as clicking the "Frontend" suggestion,
    // so it must not become a second, near-identical tag.
    expect(addSkill([], "frontend")).toEqual({ skills: ["Frontend"], error: null })
    expect(addSkill([], "  ai/ml  ")).toEqual({ skills: ["AI/ML"], error: null })
  })

  it("rejects a skill already on the list", () => {
    expect(addSkill(["QA"], "QA")).toEqual({
      skills: ["QA"],
      error: "You've already added that skill",
    })
  })

  it("rejects a duplicate that only differs by case", () => {
    expect(addSkill(["Rust"], "rust").error).toBe("You've already added that skill")
    // And across the canonical boundary: "frontend" resolves to "Frontend"
    // first, so it collides with the entry that is already there.
    expect(addSkill(["Frontend"], "frontend").error).toBe("You've already added that skill")
  })

  it("rejects characters that do not belong in a tag", () => {
    for (const bad of ["<script>", "React!", "a@b", "50%", "C++)("]) {
      expect(addSkill([], bad).error).toBe(
        "Skill can only contain letters, numbers, and . - + / #",
      )
    }
  })

  it("allows the punctuation real skill names use", () => {
    for (const good of ["C++", "Node.js", "CI/CD", "C#", "Non-technical user", "Web3"]) {
      expect(addSkill([], good).error).toBeNull()
    }
  })

  it("rejects a skill under the minimum length", () => {
    expect(addSkill([], "a").error).toBe("Skill must be at least 2 characters")
    // Whitespace is not length.
    expect(addSkill([], "  a  ").error).toBe("Skill must be at least 2 characters")
    expect(addSkill([], "   ").error).toBe("Skill must be at least 2 characters")
  })

  it("rejects a skill over the maximum length", () => {
    expect(addSkill([], "a".repeat(31)).error).toBe("Skill must be 30 characters or less")
    expect(addSkill([], "a".repeat(30)).error).toBeNull()
  })

  it("rejects a ninth skill", () => {
    expect(FULL_LIST).toHaveLength(SKILLS_MAX)
    expect(addSkill(FULL_LIST, "Rust")).toEqual({
      skills: FULL_LIST,
      error: `Maximum ${SKILLS_MAX} skills`,
    })
  })

  it("calls a full-list duplicate a duplicate, not an overflow", () => {
    // "Maximum 8 skills" would be misleading advice for an entry that was
    // never going to lengthen the list.
    expect(addSkill(FULL_LIST, "s1").error).toBe("You've already added that skill")
  })

  it("never mutates the list it was given", () => {
    const before = ["QA"]
    addSkill(before, "Rust")
    expect(before).toEqual(["QA"])
  })

  it("collapses internal whitespace before storing", () => {
    expect(addSkill([], "Machine   Learning")).toEqual({
      skills: ["Machine Learning"],
      error: null,
    })
  })
})

describe("removeSkill", () => {
  it("removes the named skill and leaves the rest in order", () => {
    expect(removeSkill(["QA", "Design", "Rust"], "Design")).toEqual(["QA", "Rust"])
  })

  it("removes regardless of the casing it is asked with", () => {
    expect(removeSkill(["Rust"], "rust")).toEqual([])
  })

  it("is a no-op for something that was never there", () => {
    expect(removeSkill(["QA"], "Rust")).toEqual(["QA"])
  })

  it("frees a slot on a full list", () => {
    const after = removeSkill(FULL_LIST, "s1")
    expect(after).toHaveLength(SKILLS_MAX - 1)
    expect(addSkill(after, "Rust").error).toBeNull()
  })
})

describe("suggestionsFor", () => {
  it("matches case-insensitively on a substring", () => {
    expect(suggestionsFor("front", [])).toEqual(["Frontend"])
    expect(suggestionsFor("END", [])).toEqual(["Frontend", "Backend"])
  })

  it("offers the whole vocabulary on an empty input", () => {
    // Focusing the field browses the list — a bare text box gives no hint that
    // a canonical set exists at all.
    expect(suggestionsFor("", [])).toHaveLength(10)
  })

  it("does not offer what is already selected", () => {
    expect(suggestionsFor("front", ["Frontend"])).toEqual([])
    expect(suggestionsFor("", ["Frontend"])).not.toContain("Frontend")
  })

  it("does not offer a canonical skill the user typed in another casing", () => {
    expect(suggestionsFor("qa", ["QA"])).toEqual([])
  })

  it("returns nothing when no canonical skill matches", () => {
    // Custom tags are never suggested — that would need a query across every
    // profile, which is out of scope.
    expect(suggestionsFor("rust", [])).toEqual([])
  })
})
