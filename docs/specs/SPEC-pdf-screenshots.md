# SPEC: PDF Screenshots Silently Dropped

**Status:** Approved 2026-10-18 with all three recommendations — implemented
**Branch:** `fix/pdf-screenshots`
**Source:** `docs/TWNHALL_PDF_SCREENSHOTS_FIX_PROMPT.md`
**Migration:** none
**New dependency:** `sharp@0.34.5` as a direct dependency (already installed
transitively by `next@16.2.1` — same version, pinned exactly)
**Risk:** low–medium — server-side image decoding; the SSRF guard is touched
only to report *why* it refused

## Summary

Three defects, one cause each, three commits. WebP is accepted at upload and
cannot be embedded in a PDF. The PDF path ignores `screenshotList()`. And all
four ways a screenshot can drop out produce the same caption with nothing
logged, which is why the first two had to be found by eye.

## §0 — Verified before writing this

**react-pdf cannot embed WebP.** `@react-pdf/image@3.1.2` (under
`@react-pdf/renderer@4.9.0`) decodes through `png-js` and `jay-peg` only;
`getImageFormat` recognises `jpg`, `png` and `svg`, and nothing else. The
comment on `imageFormat()` is right. No one-line fix exists.

**The live numbers** (read-only query, every `test_results` row; each stored
object classified by its first 16 bytes, since filenames come from the
tester's device and an extension proves nothing):

| | Images | Reports carrying one |
|---|---|---|
| WebP | **17** | **12** |
| PNG | 10 | 10 |
| JPEG | 2 | 2 |
| Total | 29 | 24 |

59% of stored screenshots, and half of all reports, currently lose their images in
the PDF. Every object fetched `200`; no storage failures exist today.

**Legacy column:** **0** rows have `screenshot_url` set and `screenshot_urls`
empty — the backfill held. §2 is fixed anyway, per the prompt.

**`sharp`:** `0.34.5` is already in `node_modules` as Next's optional
dependency for image optimisation, and Next 16 lists `sharp` in
`server-external-packages.json`, so it is required at runtime, not bundled.
Its Linux build (`@img/sharp-linux-x64` + libvips) is roughly 17–20 MB
unpacked, beside `@react-pdf`'s ~2 MB and the bundled fonts. That is well
inside Vercel's 250 MB function limit. It ships only with the functions that import it,
which is this route alone. It becomes a **direct** dependency, pinned to Next's
version: relying on a transitive optional dependency being hoisted is how a
deploy breaks on a lockfile change.

## §1 — WebP: convert server-side (fix (a)) — decision 1

**Recommended: (a).** It is the only option that fixes the 12 reports
already filed. (b) and (c) leave all 17 images broken in PDFs forever, or
need a backfill that rewrites stored objects. That is a riskier job than
decoding at read time.

In `lib/reportImages.ts`, after the fetch:

- PNG or JPEG by magic bytes → embedded as today, untouched.
- WebP by magic bytes (`RIFF....WEBP`) → `sharp(data).flatten({ background: "#ffffff" }).jpeg({ quality: 85 })`.
  JPEG, not PNG: 40 phone screenshots as PNG can push a PDF past 50 MB. The
  source WebP is already lossy, so q85 loses nothing a reader can see. `flatten`
  because a WebP with alpha turns black as JPEG.
  (The hex is a sharp argument for a white page, not a UI colour —
  `tokens.test.mts` scans `app/` and `components/` only; I'll check it does
  not trip.)
- Anything else, or a WebP sharp cannot decode → `format` failure (§3).

`sharp` is imported only here, and `lib/reportImages.ts` is imported only
by the route, so it never reaches a client bundle.

### 1.3 — One constant for both sides

The accepted and embeddable lists move into one map in
`lib/utils/screenshots.ts` (already pure, already the screenshot module, and
already imported by client components):

```ts
/** Every screenshot format a tester may upload, and how the PDF embeds it. */
export const SCREENSHOT_FORMATS = {
  "image/png": "png",    // embedded as-is
  "image/jpeg": "jpg",   // embedded as-is
  "image/webp": "webp",  // converted to JPEG by lib/reportImages.ts
} as const
```

- `ALLOWED_SCREENSHOT_TYPES` in `lib/validation/schemas.ts` becomes
  `Object.keys(SCREENSHOT_FORMATS)`. The name stays, so `AuditLogForm`'s
  `accept` attribute and `screenshotSchema` are unchanged. The upload message
  is derived from the same map, so it cannot name a format the list dropped.
- `lib/reportImages.ts` switches over the map's values, with an exhaustive
  `never` check. Adding `"image/gif": "gif"` without a conversion is then a
  **type error**, not a runtime caption.
- A test (below) feeds one real tiny file of every accepted type through
  `toEmbeddable()` and asserts a PNG/JPEG comes out. It fails if the lists
  ever diverge, whichever side moves.

## §2 — The legacy column goes through `screenshotList`

- `lib/exportDb.ts`: select `screenshot_url` too. Add it to `FeedbackRow`.
- `lib/report.ts:229`: `screenshots: screenshotList(r)`.
- `app/api/export/report/route.tsx:58`: `rows.flatMap(screenshotList)`.

No inline fallback anywhere. `screenshot_url` is a storage URL, not a person
key. The anonymity test (`scripts/anonymity.test.mts`) looks for `tester_id`,
and this does not add it.

## §3 — Four causes, named, logged, counted

`fetchOne` returns `ReportImage | { failed: Reason }` instead of `null`:

| Reason | When | Caption in the PDF | Log |
|---|---|---|---|
| `foreign` | `isOwnScreenshot` false — **guard unchanged** | "Screenshot left out — not stored by Twnhall." | `warn` |
| `unavailable` | `!res.ok` (404/403) | "Screenshot could not be loaded." | `warn` + HTTP status |
| `network` | timeout (5 s) or fetch threw | "Screenshot could not be loaded." | `warn` |
| `format` | neither PNG, JPEG nor a decodable WebP | "Screenshot format not supported in PDF." | `warn` + the sniffed kind |

`unavailable` and `network` share a caption, because to the reader both mean
"try again". They stay apart in the log.

- **Logged in the route**, which knows the report id:
  `console.warn("[export/report] screenshot left out", { reason, report: row.id, status })`.
  **No URL at any level.** The report id plus the reason is enough to find the
  object in storage. A storage path for a builder's private screenshot does not
  belong in Vercel logs.
- **Captions** come from one `screenshotCaption(reason)` in `lib/report.ts`
  (pure). The document still computes nothing.
- **Counted on page 1.** `screenshotNote(images)` in `lib/report.ts` →
  `"2 of 5 screenshots couldn't be included — each is marked where it would
  appear."`, or `null` when none failed or screenshots were off. It renders
  under the evidence line on the cover.
- **Counted at download.** The route sets `X-Screenshots-Missing: 2/5` when
  any failed. `ExportPanel` already fetches, so after saving it shows one
  `info-ink` line: "Downloaded — 2 of 5 screenshots couldn't be included." It
  does not show as an error, because the file is fine. (CSV untouched.)
- **A report where every image fails** still renders: failures are values,
  never throws. `fetchScreenshots` keeps its "never throws" contract.

## §4 — Tests

`lib/__tests__/reportImages.test.ts` (new; `fetch` stubbed, `sharp` real):

- A real 1×1 WebP → `toEmbeddable` → JPEG magic bytes; and through
  `renderToBuffer(<ReportDocument>)`, the output contains an `/Subtype /Image`
  XObject. That is the automated stand-in for `pdfimages -list`.
- Every key of `SCREENSHOT_FORMATS` has a fixture, and each yields a PNG/JPEG
  (the drift test).
- Each reason: off-bucket URL → `foreign` **and `fetch` never called** (the
  SSRF guard did not regress); 404 → `unavailable`; abort → `network`; GIF
  bytes → `format`.
- `lib/__tests__/report.test.ts`: a row with only `screenshot_url` carries
  that image; `screenshotCaption` per reason; `screenshotNote` with 0, some
  and all failed.
- `components/report/__tests__/reportDocument.test.ts`: all images failed →
  the document renders, the cover shows "5 of 5".
- `lib/validation`: `screenshotSchema`'s message is derived from the map, and
  a `.gif` is refused.

## §5 — Docs

- `CLAUDE.md`: in the PDF report paragraph, replace "PNG/JPEG by magic bytes;
  anything else is a caption" with the shared constant, the WebP conversion,
  `screenshotList` on every read, and the four logged reasons.
- `TownHall_Checklist (1).xlsx`: three QA rows (WebP to PDF, legacy column,
  caption names its cause).

## §6 — Commits

1. `fix(report): convert WebP screenshots for the PDF` — sharp, the shared
   constant, its tests
2. `fix(report): read screenshots through screenshotList` — exportDb, report, route
3. `fix(report): name, log and count dropped screenshots` — reasons,
   captions, cover line, header, ExportPanel note, tests, docs

## §7 — End to end

I run the four gates, export the live project with WebP reports, and run
`pdfimages -list` on the output (poppler, if installed — otherwise the
`/Subtype /Image` count). Then I break one URL in a local fixture and check
the caption and the log line. **What I cannot do:** submit from an Android
phone. That step is yours. Any WebP upload through the form proves the same
path.

## Decisions for you

1. **WebP fix: (a) convert server-side with `sharp`** — recommended, fixes
   the 17 existing images. Alternatives (b)/(c) leave them broken.
2. **Converted format: JPEG q85, flattened on white** — recommended over PNG
   for file size.
3. **Download note via `X-Screenshots-Missing` + ExportPanel line**, in
   addition to the cover line — recommended. Say if the cover line alone is
   enough.

## Implementation notes — where the build differs from the above

- **The WebP is ours, not Android's.** `compressImage()` (`lib/image.ts`)
  re-encodes every upload to WebP in the browser whenever that comes out
  smaller, so nearly every new screenshot is WebP on any device. This makes
  converting server-side the only real fix: refusing WebP at upload would have
  refused our own output.
- **The CSV had the same bug.** `app/api/export/feedback` counted
  `screenshot_urls` only; it now goes through `screenshotList()` too.
- **`detail` on the log line** is the HTTP status, the error name
  (`TimeoutError`), or `"webp did not decode"` / `"unrecognised bytes"`.
- **Verified live.** The real route (only auth and the limiter mocked) ran on
  the project with the most WebP: 6 screenshots, 4 of them WebP, and all 6
  drawn in the PDF (pdfjs `paintImageXObject` count, because `pdfimages` is
  not installed here). With one URL forced to 404: 5 drawn,
  `X-Screenshots-Missing: 1/6`, one log line with `unavailable`, `HTTP 404`
  and the report id, and no URL.

## Out of scope

The 5 MB cap, `MAX_SCREENSHOTS`, compression of PNG/JPEG for size, and how
screenshots render on web surfaces.
