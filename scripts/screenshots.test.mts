// Screenshot upload validation checks — the higher-risk half of the multi-upload
// change. Run with: npm test  (node strips the types, no test framework needed)

import assert from "node:assert/strict"
import {
  MAX_SCREENSHOT_BYTES,
  MAX_SCREENSHOTS,
  MAX_STEP_SCREENSHOTS,
  screenshotSchema,
  screenshotsSchema,
} from "../lib/validation/schemas.ts"
import {
  allScreenshots,
  entryScreenshots,
  labelledScreenshots,
  screenshotList,
  storagePathsFor,
} from "../lib/utils/screenshots.ts"

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
// Derived from SCREENSHOT_FORMATS, so it cannot name a format the list dropped.
assert.equal(
  screenshotSchema.safeParse(fakeFile(10, "image/gif")).error?.issues[0].message,
  "File must be PNG, JPG, or WEBP.",
)

/* ── size ────────────────────────────────────────────────────────────── */

assert.equal(screenshotSchema.safeParse(fakeFile(MAX_SCREENSHOT_BYTES, "image/png")).success, true)

const tooBig = screenshotSchema.safeParse(fakeFile(MAX_SCREENSHOT_BYTES + 1, "image/png"))
assert.equal(tooBig.success, false)
assert.match(tooBig.error!.issues[0].message, /5 MB/)

/* ── count ───────────────────────────────────────────────────────────── */

const oneShot = () => fakeFile(10, "image/png")

// No minimum on the report-level list any more: "at least one" counts step
// screenshots too, so submitTestResult checks it with both in hand.
assert.equal(screenshotsSchema.safeParse([]).success, true, "zero report-level screenshots parses")
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

/* ── step screenshots ────────────────────────────────────────────────── */

assert.equal(MAX_STEP_SCREENSHOTS, 3)
assert.ok(MAX_STEP_SCREENSHOTS < MAX_SCREENSHOTS, "the report total still bounds the steps")

assert.deepEqual(entryScreenshots({ screenshot_urls: ["s"] }), ["s"])
assert.deepEqual(entryScreenshots({}), [], "an entry filed before step screenshots has none")

const report = { screenshot_urls: ["r1"] }
const stepEntries = [
  { step_index: 2, screenshot_urls: ["c1", "c2"] },
  { step_index: 0, screenshot_urls: ["a1"] },
  { step_index: 1, screenshot_urls: [] },
]
assert.deepEqual(
  allScreenshots(report, stepEntries),
  ["r1", "a1", "c1", "c2"],
  "report-level first, then each step's in step order",
)
assert.deepEqual(labelledScreenshots(report, stepEntries).map((s) => s.step), [null, 1, 3, 3])
assert.deepEqual(allScreenshots({ screenshot_url: "legacy" }), ["legacy"], "a legacy row reads as before")

assert.deepEqual(
  storagePathsFor([
    {
      screenshot_urls: ["https://x.co/storage/v1/object/public/screenshots/u1/final.png"],
      test_result_entries: [
        { step_index: 0, screenshot_urls: ["https://x.co/storage/v1/object/public/screenshots/u1/step.png"] },
      ],
    },
  ]),
  ["u1/final.png", "u1/step.png"],
  "cleanup takes the steps' screenshots too",
)

console.log("screenshot validation checks passed")
