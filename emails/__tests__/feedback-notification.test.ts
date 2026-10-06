import { describe, expect, it } from "vitest"
import { render } from "@react-email/render"
import FeedbackNotification, { type FeedbackNotificationProps } from "@/emails/feedback-notification"

// Builders never learn who tested. The preview line matters most: the inbox
// shows it in the message list, before the email is ever opened.

const props: FeedbackNotificationProps = {
  ownerName: "Bola",
  projectName: "Acme",
  missionTitle: "Checkout flow",
  submissionSummary: "The pay button did nothing on mobile.",
  feedbackUrl: "https://twnhall.com/dashboard/p/mission/m",
}

const plain = (html: string) => html.replace(/<!--[\s\S]*?-->/g, "")

describe("feedback notification", () => {
  it("previews as new feedback on the project, with no one named", async () => {
    const html = plain(await render(FeedbackNotification(props)))
    expect(html).toContain("New feedback on Acme")
    expect(html).toContain("A tester just submitted feedback on your project")
  })

  it("never renders a tester name, even one passed by mistake", async () => {
    // The prop is gone from the type; this proves the template does not read
    // it either, should someone cast one back in.
    const stray = { ...props, testerName: "Ada Lovelace" } as FeedbackNotificationProps
    const html = await render(FeedbackNotification(stray))
    const text = await render(FeedbackNotification(stray), { plainText: true })
    expect(html).not.toContain("Ada Lovelace")
    expect(text).not.toContain("Ada Lovelace")
  })

  it("keeps the tester's words — the attribution is what goes, not the content", async () => {
    const text = await render(FeedbackNotification(props), { plainText: true })
    expect(text).toContain("The pay button did nothing on mobile.")
  })
})
