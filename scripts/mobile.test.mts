// Asserts the mobile revamp stays done, file by file. Run with: npm test
//
// The rules are SPEC-m3-foundations.md §2.2 and §3.2: a revamped file is
// written against the Material 3 size classes (medium: 600, expanded: 840),
// not Tailwind's sm:/md:, and nothing in it drops below 12px unless the class
// is pinned to desktop. Each page PR in the rollout appends its files here.
//
// Blunt string-matching, in the spirit of scripts/tokens.test.mts.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const REVAMPED = [
  "app/(public)/layout.tsx",
  "components/public/PublicHeader.tsx",
  "components/public/MobileNav.tsx",
  "components/public/DesktopNav.tsx",
  "components/public/PublicFooter.tsx",
  "components/public/ThemeToggle.tsx",
  "app/(public)/page.tsx",
  "components/public/HomeMockups.tsx",
  "components/public/prose.tsx",
  "app/(public)/pricing/page.tsx",
  "app/(public)/about/page.tsx",
  "app/(public)/contact/page.tsx",
  "components/public/DocNav.tsx",
  "app/(public)/guides/page.tsx",
  "app/(public)/guides/builder/page.tsx",
  "app/(public)/guides/tester/page.tsx",
  "app/(public)/privacy/page.tsx",
  "app/(public)/terms/page.tsx",
  "components/public/AuthCard.tsx",
  "components/public/PasswordInput.tsx",
  "components/public/HeaderCta.tsx",
  "components/public/auth/SignInForm.tsx",
  "components/public/auth/SignUpForm.tsx",
  "app/(public)/login/page.tsx",
  "app/(public)/signup/page.tsx",
  "app/terms-accept/page.tsx",
  "components/TermsAcceptForm.tsx",
  "components/setup/SetupShell.tsx",
  "components/setup/chrome.tsx",
  "components/setup/StepIndicator.tsx",
  "app/choose-account/page.tsx",
  "components/setup/RoleCards.tsx",
  "components/verification/VerificationFlow.tsx",
  "components/ui/Field.tsx",
  "components/ui/SkillsInput.tsx",
  "app/verify/[role]/page.tsx",
  "app/verify/[role]/loading.tsx",
]

const offences: string[] = []

for (const file of REVAMPED) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const at = `${file}:${i + 1}`
      // 1. No sm: or md: — catches max-sm: too, not medium:.
      for (const hit of line.matchAll(/(^|[\s"'`{-])(sm|md):/g)) {
        offences.push(`${at}  ${hit[2]}: — use medium: or expanded:`)
      }
      // 2. No 10px or 11px text unless it is the lg:/xl: pin.
      for (const hit of line.matchAll(/(\S*)text-\[1[01]px\]/g)) {
        // Directly prefixed, so max-lg: does not count as a pin.
        if (!/(^|[^\w-])(lg|xl):$/.test(hit[1])) {
          offences.push(`${at}  ${hit[0]} — 12px minimum below lg`)
        }
      }
      // 3. Screen height in dvh/svh.
      for (const bad of ["min-h-screen", "h-screen", "100vh"]) {
        if (line.includes(bad)) offences.push(`${at}  ${bad} — use dvh`)
      }
    })
}

// Legal body text is 16px until lg: every 14px there is pinned to lg.
for (const p of ["privacy", "terms"]) {
  const src = readFileSync(`app/(public)/${p}/page.tsx`, "utf8")
  for (const hit of src.matchAll(/(\S*)text-\[14px\]/g)) {
    if (hit[1].endsWith("lg:")) continue
    // The Terms section number is a 14px mono label, not body text. Look only
    // inside this class string: a fixed look-behind reached the "Last
    // updated" line's font-mono and waved the intro paragraph through.
    const from = Math.max(src.lastIndexOf('"', hit.index!), src.lastIndexOf("`", hit.index!))
    if (src.slice(from, hit.index).includes("font-mono")) continue
    offences.push(`${p}: text-[14px] below lg — legal body text is 16px until lg`)
  }
}

assert.deepEqual(offences, [], `revamped files break the mobile rules:\n  ${offences.join("\n  ")}`)

/* ── once ────────────────────────────────────────────────────────────── */

const css = readFileSync("app/globals.css", "utf8")
for (const token of ["--breakpoint-medium: 600px", "--breakpoint-expanded: 840px", "--ease-standard:"]) {
  assert.ok(css.includes(token), `globals.css is missing ${token}`)
}

// Guides: a note paragraph is NOTE, never META (META is "never a paragraph").
for (const g of ["builder", "tester"]) {
  const src = readFileSync(`app/(public)/guides/${g}/page.tsx`, "utf8")
  assert.ok(!/<p className=\{META\}/.test(src), `guides/${g}: a note paragraph uses META — use NOTE`)
}

// The app's field spelling, same rule as AuthCard's below.
const field = readFileSync("components/ui/Field.tsx", "utf8")
for (const fn of ["inputClass", "textareaClass"]) {
  const body = field.slice(field.indexOf(`function ${fn}`))
  assert.ok(/text-\[16px\] pointer-fine:text-\[14px\]/.test(body.slice(0, 400)),
    `${fn}: field text must be 16px on touch (iOS zoom)`)
}

const termsForm = readFileSync("components/TermsAcceptForm.tsx", "utf8")
assert.ok(/min-h-14/.test(termsForm) && /w-5 h-5/.test(termsForm),
  "TermsAcceptForm: the agreement row is the touch target — 56px row, 20px box below lg")

// iOS Safari zooms on focus below 16px. Touch gets 16px; only a fine pointer gets 14.
assert.ok(
  /text-\[16px\] pointer-fine:text-\[14px\]/.test(readFileSync("components/public/AuthCard.tsx", "utf8")),
  "AuthField: input text must be 16px on touch",
)

// Pricing: the header's Get started is the page's one Voltage fill.
assert.ok(
  !readFileSync("app/(public)/pricing/page.tsx", "utf8").includes("BTN_PRIMARY"),
  "pricing: BTN_PRIMARY is a second Voltage fill — the header already has one",
)

assert.ok(
  !readFileSync("components/public/MobileNav.tsx", "utf8").includes("backdrop:bg-surface"),
  "MobileNav's scrim follows the theme — it must stay literal Obsidian",
)

console.log(`mobile: ${REVAMPED.length} revamped files ok`)
