import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PublicFooter } from "@/components/public/PublicFooter"
import TermsPage from "@/app/(public)/terms/page"
import PrivacyPolicyPage from "@/app/(public)/privacy/page"
import ContactPage from "@/app/(public)/contact/page"
import { MERCHANT, addressLine } from "@/lib/merchant"

// Who a customer is paying, on every surface Paystack's MSA says they look.
// React escapes an apostrophe, so compare against the escaped form.
const esc = (s: string) => s.replace(/'/g, "&#x27;")

describe("the merchant on public pages", () => {
  it("the footer names the legal entity and the address", () => {
    const html = renderToStaticMarkup(createElement(PublicFooter))
    expect(html).toContain(esc(MERCHANT.legalName))
    expect(html).toContain(esc(addressLine()))
  })

  it("/contact shows the address, and the phone when set", () => {
    const html = renderToStaticMarkup(createElement(ContactPage))
    expect(html).toContain(esc(addressLine()))
    if (MERCHANT.phone) expect(html).toContain(`href="tel:${MERCHANT.phone}"`)
  })

  it.each([
    ["/terms", TermsPage],
    ["/privacy", PrivacyPolicyPage],
  ])("%s names the legal entity and reads the support email from MERCHANT", (_, Page) => {
    const html = renderToStaticMarkup(createElement(Page))
    expect(html).toContain(esc(MERCHANT.legalName))
    expect(html).toContain(`href="mailto:${MERCHANT.supportEmail}"`)
    expect(html).toContain(esc(addressLine()))
  })
})
