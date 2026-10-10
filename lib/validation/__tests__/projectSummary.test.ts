import { describe, expect, it } from "vitest"
import { PROJECT_SUMMARY_MAX, projectSchema } from "@/lib/validation/schemas"

// Records the round 2 decision: the summary's only length rule is the
// character cap. There used to be a two-sentence rule too; it was dropped
// rather than left enforcing a limit the form no longer mentions.
const project = (description: string) => ({
  name: "DevSync",
  app_url: "https://devsync.test",
  description,
  category: "Fintech",
})

describe("projectSchema description", () => {
  it("accepts three sentences under the cap", () => {
    const result = projectSchema.safeParse(project("Syncs dotfiles. For developers. Free."))
    expect(result.success).toBe(true)
  })

  it("still rejects a summary over the character cap", () => {
    const result = projectSchema.safeParse(project("a".repeat(PROJECT_SUMMARY_MAX + 1)))
    expect(result.success).toBe(false)
  })
})
