# Twnhall — Per-Page Skeletons + Nav Highlight on Subpages — Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

Two bugs in the logged-in shell, for both builders and testers. One PR, and the
two halves are independent: if one turns out bigger than expected, land the
other without it.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions.
2. Read `DESIGN.md` §5 and §10, and `TEST.md` §1.
3. Read `docs/specs/` and match that spec format.

Write the spec into `docs/specs/SPEC-skeletons-and-nav-active.md` first and
**stop for approval before implementing.** All four gates must pass before you
are done: `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`,
`npm test`.

**Branch:** `fix/skeletons-nav-active`
**Migration:** none

---

# 1 — Every page shows the project-card skeleton

## 1.1 — The cause

A `loading.tsx` in Next.js covers its own segment **and every nested segment
that doesn't have one of its own**. There are only three in the app shell:

| File | Mirrors | Also shown, wrongly, on |
|---|---|---|
| `app/(developer)/dashboard/loading.tsx` | My Projects (header + 2-up project cards) | `/dashboard/missions`, `/dashboard/feedback`, `/dashboard/new`, `/dashboard/[projectId]`, `…/edit`, `…/mission/new`, `…/mission/[missionId]`, `…/mission/[missionId]/edit` |
| `app/(tester)/explore/loading.tsx` | Explore (header, filters, project cards) | `/explore/missions`, `/explore/project/[projectId]` |
| `app/(tester)/tester/loading.tsx` | Tester Home | (nothing nested) |

`/mission/[id]` (tester) and `/settings` have **no** skeleton at all, so they
show a blank main area while loading.

So the skeleton is right on 3 pages, wrong on 10, and missing on 2.

## 1.2 — The fix

**Give every page in `app/(developer)` and `app/(tester)` its own
`loading.tsx` that mirrors that page's first paint.** The same rule as the
three existing files: their header comments say "Mirrors …", and the Tester
Home one explains why the shape matters (content jumping sideways on paint).

For each page: read the `page.tsx` and the components it renders above the
fold, then build the skeleton from the **same container classes** (max-width,
padding, grid), so nothing moves when real content replaces it. Work through
the pages in this order:

**Builder**

| Route | Skeleton shape (confirm against the page) |
|---|---|
| `/dashboard/missions` | Header; mission rows (title, project name, status, feedback count) |
| `/dashboard/feedback` | Header; feedback/report rows |
| `/dashboard/[projectId]` | Breadcrumb; project header (name, URL, category); missions section |
| `/dashboard/[projectId]/mission/[missionId]` | Breadcrumb; mission header + status; test-case steps; reports area |
| `/dashboard/new`, `/dashboard/[projectId]/edit`, `…/mission/new`, `…/mission/[missionId]/edit` | Breadcrumb; the form card: title, subtitle, then label + field pairs. These four should **share one `FormPageSkeleton`**, taking the number of fields and whether there is a textarea as props, if their cards really have the same frame. If the mission form (test-case steps) differs enough, give it its own. |

**Tester**

| Route | Skeleton shape |
|---|---|
| `/explore/missions` | Header; filter row if the page has one; mission cards/rows as `BrowseMissions` renders them, **not** project cards |
| `/explore/project/[projectId]` | Breadcrumb; project header; that project's missions list |
| `/mission/[id]` | Breadcrumb; mission header; the audit-log steps form. Below 1024px, include the sticky progress bar (`bfc9d54`) so the layout doesn't jump when it appears. |

**Shared:** `/settings`, the tabs and the first section.

Rules:

- **Primitives go in `components/ui/Skeleton.tsx`** next to `Bar` and
  `ProjectCardSkeleton`: e.g. `PageHeaderSkeleton`, `BreadcrumbSkeleton`,
  `FormFieldSkeleton`, `ListRowSkeleton`. Only add one when two or more pages
  use it. A one-off shape stays in its `loading.tsx`.
- **Every skeleton keeps `LoadingAnnounce`** with a page-specific label
  ("Loading your missions…", "Loading the mission…"), and `aria-hidden` on the
  shapes, exactly as the existing three do.
- **Match responsive behaviour.** Where a page stacks below 600px or changes
  columns at `lg`, the skeleton does too. Check at 360, 768 and 1280.
- **Don't fake data counts.** Show 3–4 rows or cards, as today. A skeleton
  says "something is coming", not "you have four missions".
- The existing three files don't change unless they are wrong for their own
  page.

## 1.3 — A guard so this can't come back

Add a test, `app/__tests__/loading-coverage.test.ts` or wherever `TEST.md`
puts structural tests: walk `app/(developer)` and `app/(tester)`, and **fail
if any directory with a `page.tsx` has no `loading.tsx` of its own**. The
failure message should name the directory. The next new page then can't quietly
inherit the wrong skeleton.

(If a route has a real reason to use its parent's skeleton, allow it through a
small, commented allow-list in the test. Expect none.)

---

# 2 — The nav doesn't highlight on subpages

## 2.1 — The cause

`lib/appNav.ts`:

```ts
const EXACT_MATCH = new Set(["/dashboard", "/explore", "/tester"])
```

This exists so that `/dashboard` doesn't light up on `/dashboard/missions`.
That was a real problem, because "My Missions" lives *under* "My Projects" in
the URL tree. But the exact match also switches the parent off on every page
that isn't a sibling destination: `/dashboard/new`, `/dashboard/[projectId]`
and everything under it, `/explore/project/[id]`. In the screenshot from
`/dashboard/new`, **nothing in the sidebar is highlighted**. The bottom bar
(below 840px) reads the same function, so it is broken the same way.

## 2.2 — The fix: the longest match wins

Replace the exact-match set with one rule: **among the current account's nav
links, the link whose `href` is the longest segment-wise prefix of the
pathname is active.** Only one link is ever active.

- `/dashboard/missions` → My Missions (`/dashboard/missions` is longer than
  `/dashboard`). The original case still works, with no special list.
- `/dashboard/new`, `/dashboard/abc123`, `/dashboard/abc123/edit` → My Projects.
- `/explore/missions` → Available Missions. `/explore/project/xyz` → Explore
  Projects.
- Prefixes are **segment-wise**: `/dashboardx` must not match `/dashboard`.

Shape (finalise in the spec):

```ts
/** The one nav href that owns this pathname, or null. */
export function activeNavHref(pathname: string, account: AccountType): string | null
```

`Sidebar` and `BottomNav` call it once per render instead of calling
`navIsActive` per link. Keep `navIsActive` only if something else still needs
it (the Settings row in `Sidebar` uses `navIsActive(pathname, "/settings")`:
an exact/prefix match is fine there, because Settings has no subpages and
isn't in `NAV`).

## 2.3 — Routes outside the nav's URL tree

Two pages don't sit under any nav href. Map them **to the first link of the
page's own breadcrumb**, so the sidebar and the breadcrumb never disagree:

| Route | Breadcrumb starts at | Active nav item |
|---|---|---|
| `/mission/[id]` (tester) | Explore → project → mission | **Explore Projects** |
| `/dashboard/[projectId]/mission/[missionId]` (builder) | My Projects → project → mission | **My Projects** (the prefix rule already gives this) |

Put the tester mapping in a small, commented alias table in `appNav.ts` (e.g.
`{ prefix: "/mission/", href: "/explore" }` for testers), not as a special case
inside the function. **Confirm both breadcrumbs in the code** before writing
the table, and report if they say something else.

*(Founder decision, flagged: a tester who opened a mission from **Available
Missions** may expect that item lit. Following the breadcrumb is the
consistent rule. If the founder prefers Available Missions, change the
breadcrumb too, so the two still agree.)*

## 2.4 — `aria-current`

`BottomNav` sets `aria-current="page"` on the active item. On a subpage that's
wrong: `/dashboard/new` is not the My Projects page. Use:

- `aria-current="page"` when `pathname === href`
- `aria-current="true"` when the link is active because it owns a subpage

Do the same in the sidebar's `NavItem`, which currently signals active state
by colour only. Add `aria-current` there too, so colour never carries the
meaning alone (`DESIGN.md` §10).

## 2.5 — Tests (`lib/__tests__/appNav.test.ts`)

Keep the two existing `describe` blocks passing, and rewrite the `navIsActive`
cases against `activeNavHref`. Add a table-driven test that checks **every
`page.tsx` route under `(developer)` and `(tester)`**, with a sample id
substituted for `[params]`, against its expected active href. At minimum:

| Pathname | Account | Expected |
|---|---|---|
| `/dashboard` | builder | `/dashboard` |
| `/dashboard/new` | builder | `/dashboard` |
| `/dashboard/p1` | builder | `/dashboard` |
| `/dashboard/p1/edit` | builder | `/dashboard` |
| `/dashboard/p1/mission/new` | builder | `/dashboard` |
| `/dashboard/p1/mission/m1` | builder | `/dashboard` |
| `/dashboard/p1/mission/m1/edit` | builder | `/dashboard` |
| `/dashboard/missions` | builder | `/dashboard/missions` |
| `/dashboard/feedback` | builder | `/dashboard/feedback` |
| `/settings` | builder | `null` |
| `/tester` | tester | `/tester` |
| `/explore` | tester | `/explore` |
| `/explore/missions` | tester | `/explore/missions` |
| `/explore/project/p1` | tester | `/explore` |
| `/mission/m1` | tester | `/explore` |
| `/dashboardx` | builder | `null` |

Also assert: **at most one** link is active for every row.

---

# 3 — Acceptance

- [ ] Throttle to "Slow 4G" and click through every builder and tester page
      from the sidebar and from in-page links: each one shows a skeleton
      shaped like itself, and nothing jumps when content arrives. Check 360,
      768 and 1280, both themes.
- [ ] `/mission/[id]` and `/settings` show a skeleton, not a blank area.
- [ ] The loading-coverage test fails if you delete any one `loading.tsx`
      (try it, then restore).
- [ ] On `/dashboard/new` (the screenshot), My Projects is highlighted in the
      sidebar at 1280 and in the bottom bar at 390.
- [ ] Every row of the §2.5 table is right in the sidebar and the bottom bar.
- [ ] VoiceOver/NVDA: the active item is announced as "current page" on its
      own page and as "current" on a subpage.
- [ ] `npm test` passes. All four gates.

## Commit sequence

1. `fix(nav): the longest matching destination is active, on subpages too`
   (+ tests)
2. `fix(nav): aria-current page vs true, and on sidebar items`
3. `feat(skeleton): shared skeleton primitives`
4. `fix(skeleton): per-page skeletons for the builder pages`
5. `fix(skeleton): per-page skeletons for the tester pages and settings`
6. `test(skeleton): every app page has its own loading.tsx`
