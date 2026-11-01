import { describe, expect, it } from "vitest"
import { render } from "@react-email/render"
import TesterDigest from "@/emails/tester-digest"

const SITE = "https://www.twnhall.com"
const props = {
  missions: [
    { title: "Checkout flow", projectName: "Recipe Book", meta: "Process Flow Testing · Mobile", url: `${SITE}/mission/m1` },
    { title: "First impressions", projectName: "Acme", meta: "", url: `${SITE}/mission/m2` },
  ],
  more: 3,
  browseUrl: `${SITE}/explore/missions`,
  unsubscribeUrl: `${SITE}/unsubscribe?a=acc&t=tok`,
  settingsUrl: `${SITE}/settings?tab=account`,
}

describe("tester digest email", () => {
  it("lists each test case's title and project, and the rest as a count", async () => {
    const html = await render(TesterDigest(props))
    for (const s of ["Checkout flow", "Recipe Book", "First impressions", "Acme", "Process Flow Testing · Mobile"]) {
      expect(html).toContain(s)
    }
    expect(html).toMatch(/and (<!-- -->)?3(<!-- -->)? more/)
    expect(html).toContain("Browse test cases")
  })

  it("has no field for a builder's name or email, and says nothing about pay", async () => {
    // The props carry no owner at all — the type is the guard; the text check
    // catches copy that drifts into money.
    expect(Object.keys(props.missions[0]).sort()).toEqual(["meta", "projectName", "title", "url"])
    const text = await render(TesterDigest(props), { plainText: true })
    expect(text).not.toMatch(/₦|\bpaid\b|payout|@/i)
  })

  it("links only to absolute addresses", async () => {
    const html = await render(TesterDigest(props))
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"))
    expect(hrefs.length).toBeGreaterThanOrEqual(5)
    for (const h of hrefs) expect(h.startsWith(`${SITE}/`), h).toBe(true)
    expect(hrefs).toContain(props.unsubscribeUrl)
    expect(hrefs).toContain(props.settingsUrl)
  })
})
