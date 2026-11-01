import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("server-only", () => ({}))
// Any write from the page fails the test: a GET never unsubscribes.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    throw new Error("the page wrote")
  }),
}))
vi.mock("@/actions/notifications", () => ({ unsubscribeFromEmail: vi.fn() }))

import UnsubscribePage from "@/app/(public)/unsubscribe/page"
import { createAdminClient } from "@/lib/supabase/admin"
import { unsubscribeToken } from "@/lib/unsubscribe"

const ACC = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const open = async (a: string, t: string) =>
  renderToStaticMarkup(await UnsubscribePage({ searchParams: Promise.resolve({ a, t }) }))

beforeEach(() => vi.stubEnv("SIGNING_SECRET", "test-secret"))

describe("/unsubscribe", () => {
  it("asks first: a GET renders the button and changes nothing", async () => {
    const html = await open(ACC, unsubscribeToken(ACC))
    expect(html).toContain("Stop the daily test case email?")
    expect(html).toContain('type="submit"')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it("gives a bad link one generic line and no button", async () => {
    const html = await open(ACC, "f".repeat(64))
    expect(html).toContain("This unsubscribe link isn")
    expect(html).not.toContain('type="submit"')
  })
})
