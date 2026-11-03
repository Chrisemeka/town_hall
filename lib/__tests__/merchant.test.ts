import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { MERCHANT, addressLine, legalLine, phoneDisplay, type Merchant } from "@/lib/merchant"

// Paystack's MSA wants the official name, a contact and an address on the site
// for every transaction. A placeholder on a public page, or a second copy that
// drifts, is how that goes wrong.

const PLACEHOLDER = /…|\.\.\.|TODO|XXX|____|example/i

describe("MERCHANT", () => {
  it("has no empty field and no placeholder", () => {
    const fields = [MERCHANT.tradingName, MERCHANT.legalName, MERCHANT.supportEmail, ...MERCHANT.address]
    if (MERCHANT.registration) fields.push(MERCHANT.registration.number)
    if (MERCHANT.phone) fields.push(MERCHANT.phone)
    for (const f of fields) {
      expect(f.trim()).not.toBe("")
      expect(f).not.toMatch(PLACEHOLDER)
    }
    expect(MERCHANT.address.length).toBeGreaterThan(0)
  })

  it("has a valid support email and an E.164 Nigerian phone or none", () => {
    expect(MERCHANT.supportEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    if (MERCHANT.phone !== null) expect(MERCHANT.phone).toMatch(/^\+234\d{10}$/)
  })

  it("prints the phone for reading", () => {
    expect(phoneDisplay("+2348012345678")).toBe("+234 801 234 5678")
  })
})

describe("legalLine", () => {
  const base: Merchant = {
    tradingName: "Twnhall",
    legalName: "Acme Labs Ltd",
    registration: { kind: "RC", number: "1234567" },
    address: ["12 Example Street", "Lagos", "Nigeria"],
    supportEmail: "support@twnhall.com",
    phone: null,
  }

  it("names a company Twnhall is a trading name of", () => {
    expect(legalLine(base)).toBe(
      "Twnhall is a trading name of Acme Labs Ltd (RC 1234567), 12 Example Street, Lagos, Nigeria.",
    )
  })

  it("names a business registered as Twnhall", () => {
    expect(legalLine({ ...base, legalName: "Twnhall", registration: { kind: "BN", number: "1234567" } })).toBe(
      "Twnhall (BN 1234567), 12 Example Street, Lagos, Nigeria.",
    )
  })

  it("names the people running an unregistered Twnhall", () => {
    expect(legalLine({ ...base, legalName: "Ada Obi", registration: null })).toBe(
      "Twnhall is operated by Ada Obi, 12 Example Street, Lagos, Nigeria.",
    )
  })

  it("defaults to MERCHANT", () => {
    expect(legalLine()).toContain(MERCHANT.legalName)
    expect(legalLine()).toContain(addressLine())
  })
})

describe("one copy only", () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : files(path)
      return /\.(ts|tsx)$/.test(name) ? [path] : []
    })
  }

  it("writes the support email and twnhallhq in lib/merchant.ts and nowhere else", () => {
    const offenders = ["app", "components", "emails", "lib"]
      .flatMap(files)
      .filter((f) => !f.replace(/\\/g, "/").endsWith("lib/merchant.ts"))
      .filter((f) => {
        const src = readFileSync(f, "utf8")
        return src.includes("twnhallhq") || src.includes(MERCHANT.supportEmail)
      })
    expect(offenders).toEqual([])
  })
})
