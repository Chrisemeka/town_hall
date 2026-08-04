// Screenshot upload validation checks — the higher-risk half of the multi-upload
// change. Run with: npm test  (node strips the types, no test framework needed)

import assert from "node:assert/strict"
import {
  MAX_SCREENSHOT_BYTES,
  MAX_SCREENSHOTS,
  screenshotSchema,
  screenshotsSchema,
} from "../lib/validation/schemas.ts"
import { screenshotList, storagePathsFor } from "../lib/utils/screenshots.ts"

function fakeFile(bytes: number, type: string, name = "shot.png"): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

/* ── format ──────────────────────────────────────────────────────────── */

for (const type of ["image/png", "image/jpeg", "image/webp"]) {
  assert.equal(screenshotSchema.safeParse(fakeFile(10, type)).success, true, `${type} should be accepted`)
}
for (const type of ["image/gif", "application/pdf", "text/plain", ""]) {
  assert.equal(screenshotSchema.safeParse(fakeFile(10, type)).success, false, `${type} should be rejected`)
}
assert.equal(screenshotSchema.safeParse("not-a-file").success, false)

/* ── size ────────────────────────────────────────────────────────────── */

assert.equal(screenshotSchema.safeParse(fakeFile(MAX_SCREENSHOT_BYTES, "image/png")).success, true)

const tooBig = screenshotSchema.safeParse(fakeFile(MAX_SCREENSHOT_BYTES + 1, "image/png"))
assert.equal(tooBig.success, false)
assert.match(tooBig.error!.issues[0].message, /5 MB/)

/* ── count ───────────────────────────────────────────────────────────── */

const oneShot = () => fakeFile(10, "image/png")

assert.equal(screenshotsSchema.safeParse([]).success, false, "zero screenshots is rejected")
assert.equal(screenshotsSchema.safeParse([oneShot()]).success, true)
assert.equal(
  screenshotsSchema.safeParse(Array.from({ length: MAX_SCREENSHOTS }, oneShot)).success,
  true,
  `${MAX_SCREENSHOTS} screenshots is the cap, not over it`,
)

const tooMany = screenshotsSchema.safeParse(Array.from({ length: MAX_SCREENSHOTS + 1 }, oneShot))
assert.equal(tooMany.success, false)
assert.match(tooMany.error!.issues[0].message, new RegExp(String(MAX_SCREENSHOTS)))

// One bad file in an otherwise valid batch is reported against its own index,
// which is what lets the UI name the offending screenshot.
const mixed = screenshotsSchema.safeParse([
  oneShot(),
  fakeFile(MAX_SCREENSHOT_BYTES + 1, "image/png"),
  fakeFile(10, "image/gif"),
])
assert.equal(mixed.success, false)
assert.deepEqual(mixed.error!.issues.map((i) => i.path[0]).sort(), [1, 2])

/* ── backward compatibility of stored rows ───────────────────────────── */

assert.deepEqual(
  screenshotList({ screenshot_urls: ["a", "b"], screenshot_url: "a" }),
  ["a", "b"],
  "array wins when present",
)
assert.deepEqual(
  screenshotList({ screenshot_urls: [], screenshot_url: "legacy" }),
  ["legacy"],
  "pre-migration row still renders",
)
assert.deepEqual(screenshotList({ screenshot_url: "legacy" }), ["legacy"])
assert.deepEqual(screenshotList({ screenshot_urls: null, screenshot_url: null }), [])
assert.deepEqual(screenshotList({}), [], "no screenshots is empty, not broken")

/* ── storage cleanup paths ───────────────────────────────────────────── */

assert.deepEqual(
  storagePathsFor([
    { screenshot_urls: ["https://x.co/storage/v1/object/public/screenshots/u1/1-a.png"] },
    { screenshot_url: "https://x.co/storage/v1/object/public/screenshots/u2/2-b.png" },
    { screenshot_urls: [], screenshot_url: null },
    { screenshot_urls: ["https://elsewhere.example/not-ours.png"] },
  ]),
  ["u1/1-a.png", "u2/2-b.png"],
  "every image is collected for deletion, foreign URLs are skipped",
)

console.log("screenshot validation checks passed")
