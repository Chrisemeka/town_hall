# Performance & Caching Diagnosis — November 2026

**Branch:** `chore/perf-diagnosis` · **Date:** 15 Nov 2026 · **Spec:** `docs/specs/SPEC-perf-caching-diagnosis.md`
**Measured against:** `next build && next start` (port 3100), local machine → production Supabase (`eu-west-1`). No app behaviour changed; temporary instrumentation is listed in §7.

## 1. Summary

1. **Every signed-in navigation waits on 5–8 Supabase round trips run one after another, and every one of them crosses an ocean.** Locally one trip costs p50 229 ms / p95 715 ms (254 calls, run 2), giving 790–1,740 ms document TTFB. In production the functions run in `iad1` (Washington) and the database in `eu-west-1` (Ireland), so each trip is an estimated ~75–80 ms transatlantic round trip: **~375–640 ms of pure distance per page** (F1, F3, F4).
2. **Going back to a page by link always refetches it.** `staleTimes` is not set (`next.config.ts`), so dynamic pages are kept 0 s. Every revisit in the probe refetched (16/16) and took **1,077–3,392 ms**; the back button, which uses the cache, took **25–113 ms** (F2).
3. **Middleware does two sequential Supabase calls on every request, prefetches included**: a network `getUser()` plus a profile read. Measured **~360–470 ms** typical locally (p95 of the `getUser` half alone: 1,090 ms), and 285 middleware runs for ~56 user-visible requests in one probe run (F3).

The browser is not the bottleneck: back-button navigations, which render entirely on the client from cache, finish in 25–113 ms on the same routes and bundles.

## 2. Baseline

Probe: `scripts/perf/nav-probe.ts`, signed in as one identity holding both roles. "By link" is a real `<Link>` click (every route was reached by a link, not `router.push`), timed to the moment the route's `loading.tsx` announcement is gone. TTFB and query counts are medians of 3 `curl` document requests per route (`count.txt` in §7). Wi-Fi first, **Fast 4G** (150 ms RTT, 9 / 1.5 Mb/s, CDP throttle) second.

| Route | Static or dynamic | First Load JS (kB gz) | Document TTFB (ms) | First visit by link (ms) | Revisit by link (ms) | Revisit refetched? | Back refetched? | Server queries per request |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` (signed out) | ƒ | 253 | 44 · **81** | 168 · **781** | 115 · **319** | yes | no | 0 |
| Builder dashboard `/dashboard` | ƒ | 230 | 862 · **1,931** | 1,165 · **1,726** | 1,108 · **1,077** | yes | no | 2 mw + 4 = **6** |
| Project detail `/dashboard/[projectId]` | ƒ | 333 | 917 · **1,564** | 1,597 · **1,768** | 3,392 · **3,125** | yes | no | 2 + 7 = **9** |
| Mission detail `/dashboard/[p]/mission/[m]` | ƒ | 336 | 820 · **1,175** | 3,072 · **1,867** | 1,740 · **1,513** | yes | no | 2 + 9 = **11** |
| Tester home `/tester` | ƒ | 234 | 1,267 · **3,581** | 335 · **155** ⚠ | 1,331 · **1,306** | yes | no | 2 + 9 = **11** |
| Audit-log form `/mission/[id]` | ƒ | 340 | 1,739 · **1,702** | 1,170 · **1,342** | 1,781 · **1,260** | yes | no | 2 + 8 = **10** |
| Submissions / review `/dashboard/feedback` | ƒ | 236 | 773 · **808** | 4,494 · **1,826** | 1,871 · **1,833** | yes | no | 2 + 7 = **9** |
| Settings `/settings` | ƒ | 349 | 809 · **846** | 2,283 · **2,230** | 2,070 · **1,577** | yes | no | 2 + 11 = **13** |

Back-button times (all routes, both runs): 25–113 ms, never refetched.

⚠ Tester home's *first* visit was 155–335 ms in both runs while its revisit was ~1.3 s. Not explained from here; a likely cause is that the viewport prefetch from `/explore` already held the full page. It does not change any conclusion.

Single numbers vary with the network. One dashboard document took 3,888 ms end to end when middleware's `getUser()` alone took 793 ms. Local runs carry Lagos → Ireland latency, which production does not (see F1).

**Production was not probed** (no permission given, and every page load writes `page_views`). How to get production numbers is in §7.

## 3. Suspects

| # | Verdict | Evidence |
| --- | --- | --- |
| H1 Router Cache keeps dynamic pages 0 s | **Confirmed** | `next.config.ts` has no `experimental.staleTimes`. The installed docs say `dynamic` defaults to 0 s (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/staleTimes.md`). Probe: revisit refetched 16/16, back refetched 0/16. 16.2.1 has **no** per-page stale-time export: the segment config is only `dynamicParams`, `runtime`, `preferredRegion`, `maxDuration` and the draft `unstable_instant`, which needs `cacheComponents`. |
| H2 Each navigation waits on slow server work | **Confirmed**, with one part ruled out | Waterfalls in §4 F3/F4. **Ruled out: repeated `getUser()` in Node.** It is called 3× per render (`DashboardLayout.tsx:10`, `lib/auth.ts:88` and the page), but only **one** `/auth/v1/user` request goes out per render on every route. Next's per-request `fetch` memoisation dedups identical GETs. Identical `accounts` reads are deduped the same way; reads that differ are not (settings 3, tester home 3, mission pages 2). Nothing in `lib/` uses React `cache()`. |
| H3 Functions and database in different regions | **Confirmed** (founder-reported) | Vercel functions in `iad1` (Washington), Supabase in `eu-west-1` (Ireland). `vercel.json` has no `regions`. The trip time between the two can't be measured from here; §7 says how. |
| H4 Gaps in loading boundaries | **Partly confirmed, minor** | Every builder and tester segment is covered (`find app -name loading.tsx`). Missing: the whole `(public)` group, all `/admin/**`, `/choose-account`, `/terms-accept`. Public pages answer in 33–81 ms, so it barely shows there. |
| H5 Server actions wipe the cache too broadly | **Confirmed, low impact today** | `actions/onboarding.ts:75` `revalidatePath("/", "layout")` runs on every tour completion. Today it changes nothing (there's nothing cached to wipe), but it will clear the whole client cache once H1 is fixed. All other calls are path-scoped (grep in §7). `router.refresh()` only runs on theme and billing changes. No single-argument `revalidateTag`. |
| H6 Heavy client JavaScript | **Ruled out as the main cause; real but secondary** | Back navigations render from cache in 25–113 ms. Baseline ~230 kB gz on every route, 330–350 kB on form routes (F6). |

## 4. Findings

Ranked by expected user-visible gain. Production gains are **estimates** from ~75 ms per `iad1`↔`eu-west-1` trip until §7's measurement replaces them.

| ID | Finding | Evidence | WS | Sev | Expected gain | Fix sketch | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F1 | Functions in `iad1`, database in `eu-west-1`: every Supabase call from a page crosses the Atlantic | Founder: Vercel `iad1`, Supabase `eu-west-1`. `vercel.json` has crons only. 4–11 Node-side calls per page, 3–6 in sequence (timelines below) | E | **P0** | ~225–450 ms per signed-in navigation (3–6 sequential trips × ~75 ms → ~2 ms in-region), plus a shorter Lagos ↔ function hop (Dublin is nearer Lagos than Washington) | Set the function region to `dub1` (Dublin = AWS `eu-west-1`): Vercel → Settings → Functions, or `"regions": ["dub1"]` in `vercel.json`. Hobby allows one region | Low. No code. Crons, Paystack and Resend are region-agnostic |
| F2 | Router Cache is 0 s for dynamic pages, and every app page is dynamic | `next.config.ts` (no `staleTimes`); build table: all pages ƒ; probe: 16/16 revisits refetched, 1.1–3.4 s | A, D | **P0** | Revisit within the window: **~1.1–3.4 s → ~50–100 ms** (back-button speed) | `experimental.staleTimes: { dynamic: 30 }`; the value is the founder's freshness call (§5) | Stale data ≤ 30 s, **in that browser only**. The Router Cache is in browser memory, so it can't leak across users. Every mutating action calls `revalidatePath`, and the sign-out action (`actions/auth.ts:56–57`) changes cookies and redirects; both clear it. Verify sign-out in the PR |
| F3 | Middleware: network `getUser()`, then a profile + accounts read, in sequence, on every request including prefetches | `middleware.ts:58` (`getUser`) and `:133–136` (profile). Measured `getUser` p50 233 ms / p95 1,090 ms (n=266); with profile 360–470 ms typical. 285 middleware runs for ~56 user-visible requests in run 2. JWT key is **ES256** (`/auth/v1/.well-known/jwks.json`) | C | **P0** | `getClaims()` checks the JWT locally (ES256 is confirmed): **−1 trip per request**, ~190–230 ms locally. The gate read stays | Replace `getUser()` with `getClaims()` in `middleware.ts`. Keep the gate read and both layers | **Auth trade-off:** `getClaims()` doesn't see a revoked session until its JWT expires (≤ 1 h, the project's JWT expiry). Founder's call. Sign-out still clears cookies at once |
| F4 | Server waterfalls: each page re-verifies the user over the network after middleware already did, then chains its reads | Timelines below. Node `auth:user` is 1 per render on every route; `lib/auth.ts:88`, `DashboardLayout.tsx:10` | B | **P1** | 1–3 fewer sequential trips per page: ~75–225 ms in prod, ~200–600 ms locally | (a) `getClaims()` in `lib/auth.ts`, `DashboardLayout` and the admin layout. (b) React `cache()` on `getActiveAccount` / `accountRowsFor` / `isCohortTester`. (c) Embed `test_result_entries(...)` in the `test_results` select on project, mission and feedback pages (−1 trip each). (d) Run `reportBalance()` in parallel with the entries read on mission detail. (e) Stream the tester nav badge (`newMissionCount`) behind `<Suspense>` so it stops blocking the shell | Low. (a) has F3's trade-off. `cache()` is per request, so no cross-user sharing |
| F5 | Tester shell does 3 extra sequential trips on every tester page for the new-missions badge | `DashboardLayout.tsx:47` → `lib/newMissions.ts:89` (accounts) → `:47` (missions ∥ test_results) → `lib/cohortDb.ts:26` (accounts). Tester TTFB 1,174–1,447 ms vs builder 791–862 ms | B, G | **P1** | ~225 ms prod / ~400–600 ms local off every tester document TTFB | Covered by F4(e): render the badge in its own Suspense boundary | Low. Badge appears a moment later |
| F6 | ~39 kB gz of onborda + framer-motion on every app page; ~95 kB gz of Zod + libphonenumber metadata on form routes | Chunk analysis (§7, `jsz.cjs`). `AppShell.tsx:8` imports `TourProvider` → `onborda`. Settings, verify and mission new/edit are 330–350 kB vs 230 kB | F | **P2** | Smaller first load (−39 kB on every app page); little effect on navigation | `next/dynamic` the tour only when an unseen tour applies. Check the phone schema uses libphonenumber's `min` metadata | Low |
| F7 | `markTourSeen` clears the whole client cache | `actions/onboarding.ts:75` `revalidatePath("/", "layout")` | A, D | **P2** (P1 once F2 ships) | Keeps F2's cache after each tour | Drop it or scope it. The layout reads `seen_tours`, but the client already knows the tour is done | Low |
| F8 | Every page is dynamic because the root layout reads the theme cookie | `app/layout.tsx:84` `cookies()`; build table: only `robots.txt` and `sitemap.xml` are ○ | D | **P2** | Public pages measured 33–81 ms locally, so small. In prod: the CDN can't serve them, and every hit can cold-start | Leave as is. The layout's comment records this as a deliberate choice (no theme flash). Reconsider only if production TTFB for public pages is poor | — |
| F9 | No pending state on links | `grep useLinkStatus` → none. Skeletons show at once only if a prefetch landed | G | **P2** | Perceived only | `useLinkStatus` on nav links | Low |
| F10 | Screenshots are raw `<img>` of Supabase Storage URLs | 3 screenshot `<img>` sites; `next/image` used in 2 places. Uploads are WebP via `compressImage()` | E | **P2** | Off the navigation path | Leave | — |

**Database: ruled out for now.** Row counts (PostgREST `count=exact`): profiles 46, accounts 60, projects 18, missions 31, test_results 34, test_result_entries 55, report_ledger 88. At this size a sequential scan costs microseconds, so latency is all round trips. Migrations add only `accounts_user_id_idx`, `report_ledger_*_idx`, `idx_test_result_entries_result`, `test_results_tester_status_idx` and `missions_first_published_at_idx`. The base tables predate the migrations, so their foreign-key indexes need checking in SQL (§7). `EXPLAIN` through PostgREST is off (PGRST107), and nothing was run against the database beyond reads.

**Timelines** (ms from request start, one document request each, local). `∥` = run in parallel.

```
/dashboard (builder) — 5 sequential trips
mw getUser ..858 → mw profile ..2384 → auth:user ..2670 → profiles ∥ accounts ..3552 → projects ..3888
(a slow sample; typical TTFB is 791–862)

/dashboard/[p]/mission/[m] — 7 sequential trips
mw getUser ..324 → mw profile ..686 → auth:user ..911 → profiles ∥ accounts ..1284
→ test_results ∥ missions ..1650 → test_result_entries ..2050 → accounts ∥ report_ledger ..2363

/tester — 7 sequential trips (3 for the badge)
mw getUser ..895 → mw profile ..2207 → auth:user ..2653 → accounts ∥ profiles ..3258
→ missions ∥ test_results ∥ accounts ..3531 → test_results ∥ accounts ∥ missions ..3831

/mission/[id] (tester) — 8 sequential trips
mw ..312 → mw profile ..568 → auth:user ..784 → profiles ∥ missions ..1102 → accounts ∥ projects ..1327
→ accounts ..1449 → test_results ..1656 → missions ..1953
```

Layout and page render concurrently: the layout's `profiles` and the page's `accounts` read start in the same millisecond.

## 5. Cache map

"Fresh for" is the default from the open questions: 30 s for lists, and your own writes show at once. All candidates are **Router Cache only** (per browser). Nothing per-user goes in a server-side shared cache.

| Route | Data on the page | Per-user or shared | Cached today? | Could be fresh for | Cleared by |
| --- | --- | --- | --- | --- | --- |
| `/`, `/about`, `/pricing`, `/guides/**`, `/terms`, `/privacy`, `/refunds`, `/contact` | Static content; plan numbers from `lib/plans.ts` | Shared | No (ƒ, theme cookie) | Router: 30 s. CDN: only if F8 is ever revisited | Deploy |
| `/dashboard` | Own projects with counts | Per-user | No | 30 s | `createProject`, `updateProject`, `submitTestResult` (`revalidatePath("/dashboard")`) |
| `/dashboard/[projectId]` | Project, missions, reports, entries | Per-user (owner) | No | 30 s | Mission actions (`actions/missions.ts:108,185,221,246`), `actions/project.ts:125`, admin flag |
| `/dashboard/[p]/mission/[m]` | Mission, reports, entries, allowance balance | Per-user (owner) | No | 30 s; the balance is read again at publish anyway | `actions/missions.ts:186,247`, `actions/review.ts:146` |
| `/dashboard/feedback` | All reports across own projects | Per-user | No | 30 s | `actions/review.ts:147` |
| `/dashboard/missions` | Own missions | Per-user | No | 30 s | Mission actions (path not revalidated; add it with F2) |
| `/settings` | Profile, plan, subscription, refunds, record | Per-user | No | 0–30 s. Billing return already uses `router.refresh()` | `actions/profile.ts:104`, `actions/billing.ts:253,325`, admin plan changes |
| `/tester` | Own reports, ratings, notes, live missions | Per-user | No | 30 s | `actions/review.ts:149`; new missions don't clear it (fine at 30 s) |
| `/explore`, `/explore/missions`, `/explore/project/[id]` | Live missions and projects (shared), minus own and tested | Mixed. The filter is per-user | No | 30 s | `actions/missions.ts:114,187,248`, `actions/submissions.ts:336`, admin actions |
| `/mission/[id]` | Mission, steps; own report state; start token | Mixed | No | **0 s recommended**: the form issues a start token and reads `is_active` | `submitTestResult`; a closed mission refuses on the server anyway |
| Nav badge (tester layout) | New-mission count | Per-user | No | Layouts are already kept across soft navs | `markMissionsSeen` |
| `/admin/**` | Everything | Admin | No | Leave at 0 | Existing admin `revalidatePath` calls |

`lib/testTemplates.ts` and `lib/plans.ts` are static modules, so there is nothing to cache.

## 6. Fix plan

Ordered by gain over effort. Each PR is verified by re-running the probe (§7) and comparing with §2.

1. **`perf/function-region-dub1`**: `vercel.json` gets `"regions": ["dub1"]`, or Vercel → Settings → Functions → Region → Dublin. *Verify:* on a preview with `PERF_DEBUG=1`, `[perf] supabase` lines should read single-digit ms (today ~75 ms estimated). Then Observability p50/p95 per route. *Risks:* none for data or auth. Cron times are UTC and unaffected.
2. **`perf/router-stale-times`**: `next.config.ts` `experimental.staleTimes.dynamic = 30` (the value is your answer to the freshness question). Add `revalidatePath("/dashboard/missions")` where missions change. *Verify:* probe shows `revisitRefetched: false` and revisit < 150 ms. Sign out → back → no dashboard. Approve a report → feedback list updates at once. *Risks:* up to 30 s staleness for changes made **by others** (a new report arriving); never one user's data shown to another.
3. **`perf/scope-tour-revalidate`**: `actions/onboarding.ts:75`, drop the call. It ships with or before PR 2. *Verify:* complete a tour, then revisit a page; no refetch.
4. **`perf/auth-get-claims`**: `middleware.ts`, `lib/auth.ts`, `components/layout/DashboardLayout.tsx`, `app/(admin)/layout.tsx` move from `getUser()` to `getClaims()`. Both layers stay; `email_confirmed_at` comes from the claims. *Verify:* no `/auth/v1/user` in `[perf]` logs; middleware time drops by ~1 trip; `scripts/access.test.mts` and the auth tests pass. *Risks:* a revoked or banned session stays valid until JWT expiry (≤ 1 h). If that's unacceptable, keep `getUser()` in `requireAdmin()` and ban-sensitive actions only.
5. **`perf/page-waterfalls`**: React `cache()` on `getActiveAccount`, `accountRowsFor`, `isCohortTester`. Embed entries in the `test_results` select (project, mission, feedback pages). `Promise.all` for `reportBalance` on mission detail. Suspense around the tester badge (`DashboardLayout.tsx:47`). *Verify:* sequential depth in the timelines drops (mission detail 7 → 5, tester home 7 → 4). *Risks:* `cache()` is per request only. The embedded select must keep naming columns and never select `tester_id` (anonymity, `scripts/anonymity.test.mts`).
6. **`perf/lazy-tour-bundle`**: `components/layout/AppShell.tsx`, `next/dynamic` for `TourProvider`. *Verify:* `jsz.cjs` shows −~39 kB on app routes. *Risks:* tour mounts a frame later.
7. **`perf/link-pending`** (optional): `useLinkStatus` in the sidebar and bottom nav. Perceived speed only.

Not recommended now: `cacheComponents` / `"use cache"` (a large migration, and per-user data dominates); a Next.js upgrade; indexes (tables too small to matter).

## 7. Unknowns and revert list

**Can't be measured from here, and the step to get it:**

| Unknown | Step |
| --- | --- |
| Real `iad1` ↔ `eu-west-1` trip time and per-route server time in production | Vercel → Settings → Environment Variables: add `PERF_DEBUG=1` for **Preview** only, deploy this branch as a preview, open the eight routes, then `vercel logs <preview-url>` (or Dashboard → Logs, filter `[perf]`). Each `supabase … Nms` line is one in-production trip. Remove the variable afterwards |
| p50 / p95 function duration per route | Vercel → Observability (what is included depends on the plan) → Functions → group by route |
| Real-user navigation speed from Lagos | Vercel → Speed Insights → Enable (`@vercel/speed-insights` is a separate, later PR) |
| Where middleware runs for Lagos traffic | Vercel → Logs → filter Middleware, read the region column |
| Fluid compute and cold starts | Vercel → Settings → Functions → Fluid Compute (on/off). Then compare the first request after 15 min idle with a warm one in Observability |
| Supabase Query Performance (top 20 by total and mean time) | Supabase → Reports → Query Performance |
| Foreign-key indexes on base tables | SQL editor, read-only: `select conrelid::regclass, a.attname from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey) where c.contype='f' and not exists (select 1 from pg_index i where i.indrelid=c.conrelid and i.indkey[0]=a.attnum);` |
| Production probe | `BASE=https://twnhall.com node scripts/perf/nav-probe.ts run`. Needs your go-ahead, since each load writes `page_views` |
| Hydration warnings, React DevTools profile of one navigation | Manual: open the eight routes with DevTools console + Profiler. Not done in this run |

**Temporary changes to revert (none are to be merged):**

- `instrumentation.ts`: the `register()` block marked `PERF-DIAGNOSIS` (a `fetch` wrapper that logs Supabase calls when `PERF_DEBUG=1`).
- `middleware.ts`: 4 lines marked `PERF-DIAGNOSIS` (`perf`, `t0`, two `console.log`). Note: `request.headers.has("rsc")` and `next-router-prefetch` always read false in middleware on 16.2.1, so prefetch and navigation runs were not told apart there.
- `scripts/perf/nav-probe.ts`: the probe. Playwright runs from outside the repo (`PW=` env); `package.json` is unchanged.
- Outside the repo (scratchpad, not committed): the Playwright install, `jsz.cjs` (bundle sizes), run outputs `run{1,2,3}.json`, `count.txt` and `server.log`. The session cookie and session state were **deleted** after the run. The one session used should be signed out on localhost to revoke it.

Gates on this branch: `npx tsc --noEmit` clean; `npm run lint` clean (no new `as any`; the probe has a file-level `no-explicit-any` disable because Playwright's types aren't installed); `next build` succeeded with the instrumentation in place.
