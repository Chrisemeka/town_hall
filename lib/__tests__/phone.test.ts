import { describe, expect, it } from "vitest"
import {
  dialCodeFor,
  formatPhoneAsYouType,
  isAllowedPhoneKey,
  isBareDialCode,
  phoneForCountryChange,
  type PhoneKeyEvent,
} from "@/lib/phone"

/** A keydown as the field would see it, with the caret at `caret`. */
function keydown(key: string, caret = 0, mods: { ctrlKey?: boolean; metaKey?: boolean } = {}): PhoneKeyEvent {
  return {
    key,
    ctrlKey: mods.ctrlKey ?? false,
    metaKey: mods.metaKey ?? false,
    currentTarget: { selectionStart: caret },
  }
}

describe("isAllowedPhoneKey", () => {
  it("blocks letters", () => {
    // The reported bug: "+234ddddfd" could be typed and only failed at submit.
    for (const key of ["d", "f", "A", "z"]) {
      expect(isAllowedPhoneKey(keydown(key, 4))).toBe(false)
    }
  })

  it("blocks punctuation that is not part of a number", () => {
    for (const key of ["-", "(", ".", "/", "*"]) {
      expect(isAllowedPhoneKey(keydown(key, 4))).toBe(false)
    }
  })

  it("allows digits", () => {
    for (const key of ["0", "5", "9"]) {
      expect(isAllowedPhoneKey(keydown(key, 4))).toBe(true)
    }
  })

  it("allows a space, since that is what the formatter inserts", () => {
    expect(isAllowedPhoneKey(keydown(" ", 4))).toBe(true)
  })

  it("allows + at the start and nowhere else", () => {
    expect(isAllowedPhoneKey(keydown("+", 0))).toBe(true)
    expect(isAllowedPhoneKey(keydown("+", 1))).toBe(false)
    expect(isAllowedPhoneKey(keydown("+", 7))).toBe(false)
  })

  it("allows the keys that edit and navigate", () => {
    for (const key of ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"]) {
      expect(isAllowedPhoneKey(keydown(key, 4))).toBe(true)
    }
  })

  it("allows modified keys so clipboard and undo still work", () => {
    for (const key of ["a", "c", "v", "x", "z"]) {
      expect(isAllowedPhoneKey(keydown(key, 4, { ctrlKey: true }))).toBe(true)
      expect(isAllowedPhoneKey(keydown(key, 4, { metaKey: true }))).toBe(true)
    }
  })
})

describe("formatPhoneAsYouType", () => {
  it("groups a Nigerian number as it is typed", () => {
    expect(formatPhoneAsYouType("+2348012345678", "NG")).toBe("+234 801 234 5678")
  })

  it("groups progressively rather than only when complete", () => {
    expect(formatPhoneAsYouType("+234", "NG")).toBe("+234")
    expect(formatPhoneAsYouType("+234801", "NG")).toBe("+234 801")
    expect(formatPhoneAsYouType("+2348012345", "NG")).toBe("+234 801 234 5")
  })

  it("leaves an already-formatted value alone", () => {
    // Runs on every keystroke, so a value it has already touched must survive
    // another pass unchanged or the field would drift.
    expect(formatPhoneAsYouType("+234 801 234 5678", "NG")).toBe("+234 801 234 5678")
  })

  it("re-formats an existing number when the country changes", () => {
    const typed = formatPhoneAsYouType("+12125551234", "US")
    expect(typed).toBe("+1 212 555 1234")
    // Changing the dropdown must not empty the field — the number is still
    // theirs, only the grouping is a function of the country.
    expect(formatPhoneAsYouType(typed, "NG")).not.toBe("")
    expect(formatPhoneAsYouType("0801 234 5678", "NG")).toBe("0801 234 5678")
  })

  it("truncates pasted junk, which onKeyDown cannot catch", () => {
    // Ctrl+V has to be allowed, so a paste bypasses the keydown filter
    // entirely. This is the only thing standing between it and the field.
    expect(formatPhoneAsYouType("+234ddddfd", "NG")).toBe("+234")
    expect(formatPhoneAsYouType("+234abc801def2345678", "NG")).toBe("+234")
  })

  it("survives an empty or unknown country instead of throwing", () => {
    expect(formatPhoneAsYouType("+2348012345678", "")).toBe("+234 801 234 5678")
    expect(formatPhoneAsYouType("+2348012345678", undefined)).toBe("+234 801 234 5678")
    // AQ is a real ISO 3166-1 code in our dropdown with no dialling metadata.
    expect(formatPhoneAsYouType("+2348012345678", "AQ")).toBe("+234 801 234 5678")
  })

  it("passes an empty value straight through", () => {
    expect(formatPhoneAsYouType("", "NG")).toBe("")
  })
})

describe("dialCodeFor", () => {
  it("returns the calling code for a supported country", () => {
    expect(dialCodeFor("NG")).toBe("+234")
    expect(dialCodeFor("GB")).toBe("+44")
  })

  it("returns null rather than throwing for a country with no metadata", () => {
    // These are real options in the dropdown: COUNTRIES carries all 249 ISO
    // 3166-1 codes and libphonenumber has fewer. getCountryCallingCode() throws
    // on each of these, which without the guard would take the form down on a
    // dropdown change.
    for (const code of ["BV", "HM", "AQ"]) {
      expect(dialCodeFor(code)).toBeNull()
    }
  })

  it("returns null for an empty or nonsense country", () => {
    expect(dialCodeFor("")).toBeNull()
    expect(dialCodeFor("ZZ")).toBeNull()
  })
})

describe("isBareDialCode", () => {
  it("matches the dial code with or without the trailing space", () => {
    expect(isBareDialCode("+234", "NG")).toBe(true)
    expect(isBareDialCode("+234 ", "NG")).toBe(true)
  })

  it("does not match a real number that merely starts with the dial code", () => {
    // The whole reason the check is an exact match and not a prefix match.
    expect(isBareDialCode("+234 801 234 5678", "NG")).toBe(false)
    expect(isBareDialCode("+2348012345678", "NG")).toBe(false)
  })

  it("matches for either country of a shared calling code", () => {
    expect(isBareDialCode("+1", "US")).toBe(true)
    expect(isBareDialCode("+1", "CA")).toBe(true)
  })

  it("is false for a country with no dial code", () => {
    expect(isBareDialCode("+234", "BV")).toBe(false)
  })
})

describe("phoneForCountryChange", () => {
  it("fills the dial code into an empty field", () => {
    expect(phoneForCountryChange("", "", "NG")).toBe("+234 ")
  })

  it("fills into a field holding only whitespace", () => {
    expect(phoneForCountryChange("   ", "", "NG")).toBe("+234 ")
  })

  it("swaps a bare dial code for the newly chosen country's", () => {
    expect(phoneForCountryChange("+234 ", "NG", "GB")).toBe("+44 ")
  })

  it("does not double-prefix when the two countries share a calling code", () => {
    // US and CA are both +1. Replacing rather than prepending is what keeps
    // this from becoming "+1+1 ".
    expect(phoneForCountryChange("+1 ", "US", "CA")).toBe("+1 ")
  })

  it("keeps a number the user actually typed", () => {
    // The failure this exists to prevent: type your number, notice the country
    // is wrong, fix it, and lose the number.
    const typed = "+234 801 234 5678"
    const result = phoneForCountryChange(typed, "NG", "GB")

    expect(result).not.toBeNull()
    expect(result?.replace(/\D/g, "")).toBe("2348012345678")
  })

  it("leaves the field alone when the new country has no metadata", () => {
    expect(phoneForCountryChange("+234 801 234 5678", "NG", "BV")).toBeNull()
    expect(phoneForCountryChange("", "", "BV")).toBeNull()
  })
})
