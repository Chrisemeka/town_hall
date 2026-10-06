import { describe, expect, it } from "vitest"
import { render } from "@react-email/render"
import ApprovalNotification, { type ApprovalNotificationProps } from "@/emails/approval-notification"

const props = (over: Partial<ApprovalNotificationProps> = {}): ApprovalNotificationProps => ({
  name: "Ada Lovelace",
  projectName: "Acme",
  missionTitle: "Checkout flow",
  rating: 5,
  reviewNote: null,
  reportsUrl: "https://twnhall.com/tester",
  ...over,
})

const text = (p: ApprovalNotificationProps) => render(ApprovalNotification(p), { plainText: true })

describe("approval notification", () => {
  it("renders an HTML and a plain-text part naming the mission and rating", async () => {
    const html = await render(ApprovalNotification(props()))
    const plain = await text(props())
    expect(html).toContain("Twnhall")
    expect(plain).toContain("Checkout flow")
    expect(plain).toContain("5 out of 5")
    expect(plain).toContain("https://twnhall.com/tester")
  })

  it("reads the same at a 1 as at a 5, bar the number", async () => {
    // Neutral copy: congratulations on a 1 read as sarcasm.
    const low = await text(props({ rating: 1 }))
    const high = await text(props({ rating: 5 }))
    expect(low.replace("1 out of 5", "N")).toBe(high.replace("5 out of 5", "N"))
  })

  it("shows the builder's note only when there is one", async () => {
    expect(await text(props())).not.toContain("Note from the builder")
    const withNote = await text(props({ reviewNote: "Clear repro steps, thanks." }))
    expect(withNote).toContain("Note from the builder")
    expect(withNote).toContain("Clear repro steps, thanks.")
  })

  it("says nothing about pay", async () => {
    const plain = (await text(props())).toLowerCase()
    for (const word of ["pay", "earn", "credit", "₦", "$"]) expect(plain).not.toContain(word)
  })
})
