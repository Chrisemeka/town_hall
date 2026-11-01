import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
const batchSend = vi.fn()
vi.mock("resend", () => ({ Resend: class { batch = { send: batchSend } } }))
vi.mock("@/lib/events", () => ({ recordEvent: vi.fn(async () => {}) }))

import { sendTesterDigests, type DigestMessage } from "@/lib/mail"
import { recordEvent } from "@/lib/events"

const message = (to: string): DigestMessage => ({
  to,
  subject: "New test case: Checkout flow",
  props: {
    missions: [{ title: "Checkout flow", projectName: "Acme", meta: "", url: "https://x.test/mission/1" }],
    more: 0,
    browseUrl: "https://x.test/explore/missions",
    unsubscribeUrl: "https://x.test/unsubscribe?a=1&t=2",
    settingsUrl: "https://x.test/settings?tab=account",
  },
  headers: { "List-Unsubscribe": `<https://x.test/api/unsubscribe?a=${to}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("RESEND_API_KEY", "re_test")
})

describe("sendTesterDigests", () => {
  it("sends each email with its own unsubscribe headers, and logs the batch", async () => {
    batchSend.mockResolvedValue({ data: {}, error: null })
    expect(await sendTesterDigests([message("a@x.test"), message("b@x.test")])).toBe(2)
    const payload = batchSend.mock.calls[0][0] as { to: string[]; headers: Record<string, string> }[]
    expect(payload.map((p) => p.headers["List-Unsubscribe"])).toEqual([
      "<https://x.test/api/unsubscribe?a=a@x.test>",
      "<https://x.test/api/unsubscribe?a=b@x.test>",
    ])
    expect(recordEvent).toHaveBeenCalledWith({ name: "email.sent", props: { template: "tester-digest", count: 2 } })
  })

  it("logs a Resend error and never throws or retries", async () => {
    batchSend.mockResolvedValue({ data: null, error: { message: "rate limited" } })
    expect(await sendTesterDigests([message("a@x.test")])).toBe(0)
    expect(batchSend).toHaveBeenCalledTimes(1)
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: "email.failed", props: expect.objectContaining({ template: "tester-digest" }) }),
    )
  })
})
