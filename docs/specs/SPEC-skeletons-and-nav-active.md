# SPEC: Per-Page Skeletons + Nav Highlight on Subpages

**Status:** Draft, awaiting approval
**Branch:** `fix/skeletons-nav-active`
**Base:** `main`
**Source:** `docs/TWNHALL_SKELETONS_NAV_PROMPT.md`
**Migration:** none
**Risk:** low. Loading files are new and render only while a route streams.
The nav change is one pure function with a table test. No data, auth or
query changes.

## Summary

Two independent fixes in the logged-in shell, for both roles:

1. **Skeletons.** Every page in `app/(developer)` and `app/(tester)` gets its
   own `loading.tsx` that mirrors its first paint. A test fails if a page is
   ever added without one.
2. **Nav highlight.** The active sidebar and bottom-bar item is the nav link
   whose `href` is the longest segment-wise prefix of the path. A short alias
   table covers the one route outside the nav's URL tree. `aria-current` says
   `page` on the page itself and `true` on a subpage, in both navs.

The nav half lands first (commits 1–2), so it can ship alone if the skeletons
grow.

---

## Part A — Nav

### A.1 Findings confirmed in the code

| Claim | Confirmed | Where |
|---|---|---|
| `EXACT_MATCH` switches the parent off on subpages | Yes | `lib/appNav.ts`: `/dashboard`, `/explore`, `/tester` match only themselves |
| `Sidebar` and `BottomNav` call `navIsActive` per link | Yes | `Sidebar.tsx:113`, `BottomNav.tsx:33` |
| Sidebar `NavItem` signals active by colour only | Yes | `text-accent-ink bg-voltage/[0.06]`, no `aria-current` |
| `BottomNav` sets `aria-current="page"` on subpages too | Yes | `BottomNav.tsx:38` |
| Tester mission breadcrumb starts at Explore | **Yes** | `app/(tester)/mission/[id]/page.tsx`: `Explore › project › mission` (from 600px; below it, a back link to `/explore/project/[id]`) |
| Builder mission breadcrumb starts at My Projects | **Yes** | `…/mission/[missionId]/page.tsx`: `My Projects / project / mission` |

### A.2 `lib/appNav.ts`

```ts
/** Segment-wise prefix: /dashboard owns /dashboard/x, never /dashboardx. */
export function navIsActive(pathname: string, href: string): boolean

/**
 * Routes outside every nav href's URL tree, mapped to the first link of the
 * page's own breadcrumb so the nav and the breadcrumb never disagree.
 */
const NAV_ALIASES: Record<AccountType, { prefix: string; href: string }[]> = {
  builder: [],
  // /mission/[id]: Explore › project › mission.
  tester: [{ prefix: "/mission", href: "/explore" }],
}

/** The one nav href that owns this pathname, or null. */
export function activeNavHref(pathname: string, account: AccountType): string | null

/** "page" on the destination itself, "true" on a page it owns. */
export function navCurrent(pathname: string, href: string): "page" | "true"
```

- `activeNavHref` picks the longest `href` among `NAV[account].links` for which
  `navIsActive` holds. Only if none does, it checks `NAV_ALIASES`, using the
  same segment-wise match. Exactly one result or `null`, so at most one item
  is active.
- `EXACT_MATCH` is deleted. `navIsActive` stays, as the plain segment-wise
  test, because the Settings row still uses it (`/settings`, not in `NAV`).
- The tester alias follows the breadcrumb, as the prompt decides. The founder
  question (Available Missions instead) is noted in the prompt; if the answer
  changes, the alias and the breadcrumb change together.

### A.3 Callers

- `Sidebar` and `BottomNav` compute
  `const active = activeNavHref(pathname, account)` once per render, then
  `href === active` per link.
- `aria-current={href === active ? navCurrent(pathname, href) : undefined}`
  in both. The sidebar's `NavItem` gains an optional `current` prop, passed
  straight to the `<Link>`. The Settings row passes `"page"` when active, since
  it has no subpages.

### A.4 Tests (`lib/__tests__/appNav.test.ts`)

- The two existing `NAV` blocks stay.
- The `navIsActive` cases are rewritten for the segment-wise rule, including
  `/dashboardx` against `/dashboard`.
- A table test over every `page.tsx` route under `(developer)` and
  `(tester)`, with `p1`/`m1` substituted for params. It covers the prompt's
  sixteen rows plus `/dashboard/p1/mission/m1/edit`, `/settings` for a tester,
  and `/dashboard` for a tester (`null`: a builder href never lights for a
  tester). Each row also asserts at most one link is active.
- `navCurrent`: `page` on `/dashboard`, `true` on `/dashboard/new`.

---

## Part B — Skeletons

### B.1 Findings confirmed in the code

All 18 `page.tsx`/`loading.tsx` files under the two groups, listed:

| Page | Has own `loading.tsx` | Shows today |
|---|---|---|
| `/dashboard` | ✅ | correct |
| `/dashboard/missions`, `/feedback`, `/new` | — | the project-card grid |
| `/dashboard/[projectId]`, `/edit`, `/mission/new`, `/mission/[missionId]`, `/mission/[missionId]/edit` | — | the project-card grid |
| `/settings` | — | nothing (blank) |
| `/explore` | ✅ | correct |
| `/explore/missions`, `/explore/project/[projectId]` | — | Explore's project cards |
| `/tester` | ✅ | correct |
| `/mission/[id]` | — | nothing (blank) |

That's **12 new files**. The prompt's table lists 11, so I've added
`/dashboard/[projectId]/edit`, which also inherits the wrong skeleton.

### B.2 What each page paints first, and therefore its skeleton

Each skeleton copies its page's **own container classes**. Three pages
haven't been revamped yet (`[projectId]/edit`, `mission/[missionId]/edit`,
`explore/project/[projectId]`) and use older containers (`py-10`, `px-6`,
`md:`). Their skeletons copy those as they are. Fixing the containers belongs
to their revamp turn, not here, and copying them is what stops the jump.

| Route | Container | First paint |
|---|---|---|
| `/dashboard/missions` | `max-w-[800px]` revamped | Header (h1, subline, and from 600px `+ Add Mission` beside it, full width below 600px); 4 mission row cards (project name, title, then count + badge) |
| `/dashboard/feedback` | `max-w-[800px]` | Header; 2 mission groups (project, title), each with 2 report rows (`border-l-[3px]`: tester · time, pass-rate line, "Read full feedback") |
| `/dashboard/[projectId]` | `max-w-[1128px]` | Breadcrumb (back link below 600px, trail from 600px); header (name + badge, URL, two-line summary, Edit button); tab bar (two tabs, `+ Add Mission` from 600px); 3 mission row cards |
| `…/mission/[missionId]` | `max-w-[1128px]`, `expanded:py-8` | Nav bar (back link + 2-up actions below 600px; Back, trail, actions from 600px, ruled below); badge + title; chips; "Test steps" label; 3 step cards; a report area block |
| `/dashboard/new` | `max-w-[640px]` | Breadcrumb; **project form** (card from 600px only) |
| `…/[projectId]/edit` | `max-w-[1128px] … py-8`, form `max-w-2xl` | Trail breadcrumb at every width; **project form**, always carded |
| `…/mission/new` | `max-w-[640px]` | Breadcrumb; **mission form** (card from 600px) |
| `…/mission/[missionId]/edit` | `max-w-[640px] px-6 py-10` | Trail breadcrumb; **mission form**, always carded |
| `/settings` | `max-w-[640px]` | Header; tab strip; first section (heading + 3 fields) |
| `/explore/missions` | `max-w-[800px]` | Header; search field (`w-full medium:w-[280px]`); 4 mission rows as `BrowseMissions` renders them (number · meta, title, chips, "Start"). **No** filter pills, because the page has none |
| `/explore/project/[projectId]` | `max-w-[800px] px-6 md:px-8 py-10` | Breadcrumb; project card (name, URL, summary); "Missions" heading + count; 3 numbered mission rows |
| `/mission/[id]` | `max-w-[800px]` | Breadcrumb; `MissionBrief` (title, project card, chips, "Test steps" + 3 step cards); the **Open Project** button and its one-line hint |

**`/mission/[id]` and the sticky progress bar: a deviation from the
prompt.** The prompt asks to include the progress bar from `bfc9d54` below
1024px. I checked: `AuditLogForm` mounts the whole form, and with it
`ReportProgressBar`, **only after the tester presses "Open Project in New
Tab"** (`unlocked`, `AuditLogForm.tsx:313`). The first paint is the brief,
that button and its hint. A skeleton progress bar would show a bar that the
loaded page doesn't have, then remove it, which is the jump the rule exists to
prevent. So the skeleton ends at the button and the hint, as the page does.

### B.3 Primitives, in `components/ui/Skeleton.tsx`

Each is added only because two or more pages use it:

| Primitive | Used by |
|---|---|
| `PageHeaderSkeleton({ action? })`: h1 + subline bars, at the revamped heading sizes | missions, feedback, explore/missions, settings |
| `BreadcrumbSkeleton({ compactBack? })`: a 48px back-link bar below 600px and a trail from 600px, or the trail at every width when `compactBack` is false (unrevamped pages) | project detail, new project, new mission, tester mission, the two edit pages, explore/project |
| `ListRowSkeleton({ lines?, trailing? })`: the row card `bg-surface-raised border border-line rounded-[12px] px-4 py-4 medium:px-6 medium:py-5` | missions, project detail, explore/missions |
| `FormFieldSkeleton({ tall? })`: label + 48px input, or a textarea | the two form skeletons, settings |
| `ProjectFormSkeleton({ framed })`: title, subline, name/URL/category/description fields, actions. `framed: "always"` (edit) or `"medium"` (new) | `/dashboard/new`, `…/edit` |
| `MissionFormSkeleton({ framed })`: title, subline, title field, the test-case editor's category cards (`lg:grid-cols-3`) + steps, actions | `…/mission/new`, `…/mission/[missionId]/edit` |
| `StepCardSkeleton`: a test-case step card | builder mission page, tester mission page |

One-offs stay in their `loading.tsx`: the feedback group rows, the
project-detail tab bar, the explore/project numbered rows, and the builder
mission's nav bar.

The existing three files don't change. The Explore and My Projects ones already
mirror their pages. They don't use the new primitives either, because the
prompt says to leave them unless they're wrong, and they aren't.

### B.4 Shared rules

- Every file: `LoadingAnnounce` with a page-specific label ("Loading your
  missions…", "Loading feedback…", "Loading the project…", "Loading the
  mission…", "Loading the form…", "Loading settings…", "Loading
  missions…", "Loading the project's missions…"), and `aria-hidden` on the
  shapes.
- Responsive breakpoints are the page's own: `medium:`/`expanded:`/`lg:` on
  revamped pages, the old `md:` on the three unrevamped ones, copied rather
  than "fixed". `scripts/mobile.test.mts` only lists revamped files, and the
  new loading files for revamped pages join it.
- No faked counts: 3–4 rows or cards.
- Every spacing value divisible by 4.

### B.5 The guard: `app/__tests__/loadingCoverage.test.ts`

The test walks `app/(developer)` and `app/(tester)` with `fs.readdirSync`.
Every directory that has a `page.tsx` but no `loading.tsx` fails, and the
message names it, e.g.

```
app/(tester)/mission/[id] has a page.tsx but no loading.tsx of its own — it
would inherit its parent's skeleton (or none). Add one that mirrors the page.
```

The allow-list is empty, with a comment saying when an entry is justified.
I'll prove the test works by deleting one `loading.tsx`, running it, and
restoring the file, and I'll report the output.

### B.6 How I'll verify

In headless Chrome, at 360, 768 and 1280 and in both themes, I'll render each
`loading.tsx` and compare it against the loaded page at the same width: the
container's left and width, the heading's top, and the first row's top.
"Nothing jumps" becomes numbers to within 4px. The pages need a signed-in
account, which I don't have. So the skeletons get rendered directly, through a
throwaway test-only route that I delete before committing, or by throttling
if you can sign me in. **Slow 4G click-through and VoiceOver/NVDA are yours
to check.** I can't run them here.

---

## Commits

1. `fix(nav): the longest matching destination is active, on subpages too` (+ tests)
2. `fix(nav): aria-current page vs true, and on sidebar items`
3. `feat(skeleton): shared skeleton primitives`
4. `fix(skeleton): per-page skeletons for the builder pages`
5. `fix(skeleton): per-page skeletons for the tester pages and settings`
6. `test(skeleton): every app page has its own loading.tsx`
