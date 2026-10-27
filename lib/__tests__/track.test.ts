import { describe, expect, it } from "vitest"
import { countryFrom, deviceFrom, isBot, isUntracked, normalisePath, referrerHost } from "@/lib/track"

const ID = "9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b"

describe("normalisePath", () => {
  it("replaces ids and numbers, drops the query and fragment", () => {
    expect(normalisePath(`/mission/${ID}?tab=1#top`)).toBe("/mission/[id]")
    expect(normalisePath(`/dashboard/${ID}/missions/42`)).toBe("/dashboard/[id]/missions/[id]")
  })
  it("keeps slugs and the root", () => {
    expect(normalisePath("/guides/builder")).toBe("/guides/builder")
    expect(normalisePath("/")).toBe("/")
    expect(normalisePath("")).toBe("/")
  })
})

describe("isUntracked", () => {
  it("drops the console and the API, nothing else", () => {
    expect(isUntracked("/admin")).toBe(true)
    expect(isUntracked("/admin/accounts")).toBe(true)
    expect(isUntracked("/api/track")).toBe(true)
    expect(isUntracked("/administrator")).toBe(false)
    expect(isUntracked("/pricing")).toBe(false)
  })
})

describe("isBot", () => {
  it("refuses crawlers, headless browsers and a missing UA", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true)
    expect(isBot("Mozilla/5.0 HeadlessChrome/120")).toBe(true)
    expect(isBot(null)).toBe(true)
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1")).toBe(false)
  })
})

describe("deviceFrom", () => {
  it("buckets phones, tablets and the rest", () => {
    expect(deviceFrom("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148")).toBe("mobile")
    expect(deviceFrom("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari")).toBe("mobile")
    expect(deviceFrom("Mozilla/5.0 (Linux; Android 13; SM-X700) Safari")).toBe("tablet")
    expect(deviceFrom("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("tablet")
    expect(deviceFrom("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop")
  })
})

describe("referrerHost", () => {
  it("keeps only the host, and never our own", () => {
    expect(referrerHost("https://www.google.com/search?q=twnhall", "twnhall.com")).toBe("www.google.com")
    expect(referrerHost("https://twnhall.com/pricing", "twnhall.com")).toBeNull()
    expect(referrerHost("http://localhost:3000/x", "localhost:3000")).toBeNull()
    expect(referrerHost("not a url", "twnhall.com")).toBeNull()
    expect(referrerHost(null, "twnhall.com")).toBeNull()
  })
})

describe("countryFrom", () => {
  it("accepts two letters only", () => {
    expect(countryFrom("ng")).toBe("NG")
    expect(countryFrom("XYZ")).toBeNull()
    expect(countryFrom(null)).toBeNull()
  })
})
