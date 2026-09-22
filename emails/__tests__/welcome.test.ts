import { describe, expect, it } from "vitest"
import { render } from "@react-email/render"
import Welcome from "@/emails/welcome"
import { completionHeadlineFor, nextStepsFor } from "@/lib/setup"
import type { AccountType } from "@/lib/access"

// React Email renders to a string, so the template is testable in the existing
// node environment — no DOM, no new test infrastructure.
//
// What this proves is the wiring, not the copy: the three steps come from
// lib/setup.ts, which is where they are checked for content. If they stop
// arriving in the output, the email and the completion screen have diverged.

const props = (role: AccountType) => ({
  name: "Ada Lovelace",
  role,
  headline: completionHeadlineFor(role),
  nextSteps: nextStepsFor(role),
  ctaUrl: `https://twnhall.com${role === "tester" ? "/explore" : "/dashboard"}`,
  ctaLabel: role === "tester" ? "Find a mission" : "Go to your dashboard",
})

// The renderer entity-encodes, and React separates adjacent text nodes with
// an empty HTML comment — so "Hi {firstName}," arrives as "Hi <!-- -->Ada<!-- -->,".
// Comparisons have to see through both.
const plain = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")

describe.each(["builder", "tester"] as const)("welcome email — %s", (role) => {
  it("renders", async () => {
    const html = await render(Welcome(props(role)))
    expect(html.length).toBeGreaterThan(0)
    expect(html).toContain("Twnhall")
  })

  it("greets by first name only", async () => {
    const html = plain(await render(Welcome(props(role))))
    expect(html).toContain("Hi Ada,")
    expect(html).not.toContain("Hi Ada Lovelace,")
  })

  it("carries all three of that role's next steps", async () => {
    const html = plain(await render(Welcome(props(role))))
    for (const step of nextStepsFor(role)) {
      expect(html).toContain(plain(step.title))
      expect(html).toContain(plain(step.detail))
    }
  })

  it("links the CTA at that role's home", async () => {
    const html = await render(Welcome(props(role)))
    expect(html).toContain(role === "tester" ? "/explore" : "/dashboard")
  })

  it("ships a usable plain-text part", async () => {
    // HTML-only is one of the cheapest spam signals there is, and a text part
    // that renders empty is worse than none.
    const text = await render(Welcome(props(role)), { plainText: true })
    expect(text.trim().length).toBeGreaterThan(200)
    expect(plain(text)).toContain(plain(nextStepsFor(role)[0].title))
  })
})

describe("the role branch actually branches", () => {
  it("produces different mail for a builder and a tester", async () => {
    const builder = await render(Welcome(props("builder")))
    const tester = await render(Welcome(props("tester")))
    expect(builder).not.toEqual(tester)
  })

  it("does not leak the other role's steps", async () => {
    const builder = plain(await render(Welcome(props("builder"))))
    for (const step of nextStepsFor("tester")) {
      expect(builder).not.toContain(plain(step.title))
    }
  })

  it("names the account type it is about", async () => {
    expect(await render(Welcome(props("tester")))).toContain("Tester account")
    expect(await render(Welcome(props("builder")))).toContain("Builder account")
  })
})

describe("a missing name does not produce a broken greeting", () => {
  it("falls back rather than rendering 'Hi ,'", async () => {
    const html = plain(await render(Welcome({ ...props("builder"), name: "" })))
    expect(html).toContain("Hi there,")
    expect(html).not.toContain("Hi ,")
  })
})
