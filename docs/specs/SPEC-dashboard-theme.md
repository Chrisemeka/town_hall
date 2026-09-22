# SPEC: Theme the Dashboard

**Status:** Awaiting approval
**Branch:** `feat/dashboard-theme`
**Base:** `main` (Stage 1 and Stage 2 merged)
**Blocks:** `feat/settings-sections` (PR 2), `feat/feedback-export` (PR 3)
**Source:** `docs/TWNHALL_BUILDER_DASHBOARD_PROMPT.md` — PR 1
**Migration:** none
**Risk:** medium — **76 files**, mechanical, and the dangerous part is not the part the brief tabulates

## Summary

Every surface follows the theme. `data-theme` moves to the root layout, the
literal palette tokens become semantic ones across the app, and the two accent
pairs Stage 1 established become four. Nothing else ships in this PR.

## §0 — The survey, because the brief undercounts it

The brief's §1.2 gives a five-row mapping table. Measured against the codebase,
those five rows are **867 occurrences across 76 files** — and they are the
*safe* part. The part that actually breaks is not in the table:

| Literal | Uses | What happens in light mode today |
|---|---|---|
| `text-voltage` | **90** | **1.02:1 on Bone — invisible** |
| `border-voltage` | 54 | invisible boundary |
| `ring-voltage` | 20 | invisible focus ring |
| `text-ember` | 41 | 2.97:1 — fails the label bar |
| `border-ember` | 28 | fails WCAG 1.4.11's 3:1 |
| `text-sky` | 10 | 2.02:1 — fails |
| `border-sky` | 5 | fails |
| `text-mint` | 1 | **1.20:1 — invisible** |

**All four accent colours fail as text on Bone.** Measured:

| | as text on Bone | on Obsidian |
|---|---|---|
| Voltage `#E8FF47` | **1.02** ✗ | 17.29 ✓ |
| Mint `#3FFFA2` | **1.20** ✗ | 14.73 ✓ |
| Sky `#47B8FF` | **2.02** ✗ | 8.79 ✓ |
| Ember `#FF4F4F` | **2.97** ✗ | 5.95 ✓ |

So this is not four special cases, it is one rule with four instances — which
is what §1.3 asks `DESIGN.md` to end up saying.

**If only the brief's five rows are done, the dashboard renders in light mode
with invisible focus rings, invisible active states and unreadable status
badges** — and it will look finished. That is the failure this PR has to avoid,
and §6's test is what makes it checkable.

## Non-goals

- **Every feature in PRs 2 and 3.** Nothing but the rename and the tokens.
  Mixing a 76-file rename with new features makes the diff unreviewable.
- **`emails/`** — email clients do not honour a site's theme and those
  templates are already dark-on-dark by choice.
- **Redesigning anything.** If a screen looks wrong in light mode because the
  *layout* is wrong, note it; do not fix it here.
- **Tier enforcement, settings, export.** Later PRs.

## §1 — The rule that goes away entirely

`CLAUDE.md` currently reads, after Stage 2's revision:

> **Surfaces:** App surfaces — `(developer)`, `(tester)`, `(admin)` — are dark
> and use the **literal** palette tokens. **Themed** surfaces use the
> **semantic** token layer … Two groups of routes are themed: the `(public)`
> group … and **the setup chain** …

**All of it goes.** Replacement:

> **Surfaces:** Every surface follows the theme. Use the **semantic** token
> layer — `surface`, `surface-raised`, `ink`, `ink-muted`, `line`,
> `accent`/`accent-ink`, `danger-ink`, `success-ink`, `info-ink` — everywhere.
> `data-theme` is set once, on `<html>` in `app/layout.tsx`, from the
> `th_theme` cookie. The literal palette tokens remain defined in
> `globals.css` because the semantic layer is built out of them, and they are
> what a **fill** uses (see the accent rule); they are not to be used directly
> for a surface, text, border or ring.

Mirror into `DESIGN.md`, and delete the per-group carve-outs Stage 1 and Stage
2 added rather than leaving three half-true paragraphs stacked up.

## §2 — Where `data-theme` goes

Onto `<html>` in `app/layout.tsx`, read from the cookie exactly as the two
existing shells do.

Consequences, all of them acceptable and all stated so none is a surprise:

- **`app/(public)/layout.tsx` and `components/setup/SetupShell.tsx` stop
  setting it.** Two nested `data-theme` attributes agreeing is harmless until
  the day they disagree.
- **`<body>`'s `bg-obsidian text-chalk` becomes `bg-surface text-ink`**, which
  also removes the overscroll oddity Stage 1 documented and left alone.
- **`/_not-found` moves from static to dynamic.** It is the only statically
  rendered page left; `robots.txt` and `sitemap.xml` are route handlers and are
  unaffected. A dynamic 404 is a fair price for one attribute in one place.

## §3 — The mapping, in full

Applied across `app/` and `components/`. The brief's five rows are the first
block; the rest is what §0 found.

**Surfaces, text and lines**

| Literal | Semantic | Uses |
|---|---|---|
| `bg-obsidian` | `bg-surface` | 60 |
| `bg-graphite` | `bg-surface-raised` | 57 |
| `text-chalk` | `text-ink` | 248 |
| `text-ash` | `text-ink-muted` | 324 |
| `border-iron` | `border-line` | 178 |
| `border-ash` | `border-ink-muted` | 21 |
| `text-iron` | `text-line` | 18 |
| `bg-iron` | `bg-line` | 8 |
| `divide-iron` | `divide-line` | 3 |
| `border-chalk` | `border-ink` | 2 |

`text-iron` is breadcrumb separators — deliberately low contrast, and `line` is
the token that means "deliberately low contrast". `border-ash` is the hover
border on secondary buttons, which wants the stronger `ink-muted` because a
control boundary needs 3:1 (WCAG 1.4.11) and `line` gives 1.19:1.

**Accent ink — text, borders, rings, icons**

| Literal | Semantic | Uses |
|---|---|---|
| `text-voltage` | `text-accent-ink` | 90 |
| `border-voltage` | `border-accent-ink` | 54 |
| `ring-voltage` | `ring-accent-ink` | 20 |
| `text-ember` | `text-danger-ink` | 41 |
| `border-ember` | `border-danger-ink` | 28 |
| `text-sky` | `text-info-ink` | 10 |
| `border-sky` | `border-info-ink` | 5 |
| `text-mint` | `text-success-ink` | 1 |

**Fills — unchanged, and that is the rule, not an oversight**

`bg-voltage`, `bg-mint`, `bg-ember`, `bg-sky` stay literal. A fill is the same
colour in both themes and always carries **Obsidian** text, which is 17.3:1 on
Voltage, 14.7:1 on Mint, 8.8:1 on Sky and 6.0:1 on Ember. `bg-voltage-dark`
stays as the hover on a Voltage fill. `text-obsidian` stays wherever it sits on
one of those fills.

Tinted fills (`bg-voltage/10`, `bg-ember/10`) keep working: a 10% tint over
either ground, with the matching `*-ink` on top, reads in both themes. That is
the `DESIGN.md` §5.4 badge and it survives the swap intact.

## §4 — The two new inks

Derived the way `danger-ink` was: darken until it clears the label bar on Bone,
collapse back to the original in dark.

```css
/* light */                      /* dark */
--color-success-ink: #046334;    --color-success-ink: #3FFFA2;  /* Mint */
--color-info-ink:    #0A5490;    --color-info-ink:    #47B8FF;  /* Sky */
```

| Token | Light on Bone | Dark on Obsidian |
|---|---|---|
| `accent-ink` | Forest `#353D00` — 10.60 | Voltage — 17.29 |
| `danger-ink` | `#A81E15` — 6.74 | Ember — 5.95 |
| **`success-ink`** | **`#046334` — 6.79** | Mint — 14.73 |
| **`info-ink`** | **`#0A5490` — 7.19** | Sky — 8.79 |

`success-ink` is picked to land at 6.79 rather than the 6.17 of a lighter green
so the four pairs sit in the same band — `danger-ink` is 6.74 and a status row
showing both should not have one obviously fainter than the other. Re-verify
each at WebAIM before merge.

`DESIGN.md` documents these as **one pattern in two halves** — *a fill is the
literal and carries Obsidian text; ink is the `*-ink` token and follows the
theme* — not as four separate notes.

## §5 — The things that are not class renames

**Shadow.** `--shadow-card: 0 2px 12px rgba(0,0,0,0.4)` is tuned for a dark
ground; at 40% black on Bone it is a smudge. It becomes a themed variable —
roughly `rgba(0,0,0,0.08)` on light, unchanged on dark — defined beside the
colour tokens so it moves with them.

**Charts.** `components/admin/SignupsChart.tsx` and
`RoleDistributionChart.tsx`. Axis, grid and tooltip colours read from CSS
variables rather than literals. Recharts takes colours as props, not classes,
so these need `var(--color-…)` strings, and the series palette must stay
distinguishable on both grounds — check it as a set, not colour by colour.

**Tours.** `components/tours/OnbordaCard.tsx` and the overlay. The card is
themed like any panel; the backdrop is a dark scrim on both themes, which is
correct and should be left as a literal with a comment saying so.

**Skeletons.** Three `loading.tsx` files plus `components/ui/Skeleton.tsx`. A
skeleton is a contrast effect, not a colour — it needs to be visible against
`surface` in both themes, which today's `bg-graphite` will not be on Bone.

## §6 — Making "finished" checkable

**`scripts/tokens.test.mts`**, blunt string-matching in the spirit of
`scripts/guides.test.mts`.

A 76-file rename is exactly where one missed file renders dark-on-dark and
nobody notices for a month. The test asserts that no literal appears as a
**surface, text, border, ring or divide** utility anywhere in `app/` or
`components/`:

```
bg-obsidian  bg-graphite  bg-iron   text-chalk  text-ash  text-iron
border-iron  border-ash   border-chalk  divide-iron
text-voltage border-voltage ring-voltage
text-ember   border-ember
text-sky     border-sky
text-mint    border-mint
```

**Allowed, and the test says why in its own comments:** `bg-voltage`,
`bg-voltage-dark`, `bg-mint`, `bg-ember`, `bg-sky` (fills), `text-obsidian`
(text on a fill), `accent-voltage` (the native checkbox accent), and anything
in `globals.css`, `emails/` or a `ponytail:`-commented deliberate inversion.

**This test is the acceptance criterion for completeness**, and it is why the
rename can be trusted without rendering all 40 pages by hand first.

## §7 — A consolidation this unlocks

`components/ui/Field.tsx` and `components/setup/chrome.tsx` are the same
Design.md §5.2 chrome twice — one in literal dark tokens, one semantic. That
duplication exists **only because two token systems existed**, which is what
this PR removes. `components/ui/SkillsInput.tsx` carries a `surface` prop for
the same reason, and its own comment says the prop disappears when the
dashboard joins the theme system.

So: `components/ui/Field.tsx` becomes the single spelling, `setup/chrome.tsx`
re-exports or is deleted, and the `surface` prop goes. **Three deletions the
rename pays for**, and leaving them would mean shipping the duplication past
the day its reason expired.

## Acceptance criteria

1. `data-theme` is set once, on `<html>`, from the cookie; the two nested
   attributes are gone.
2. `scripts/tokens.test.mts` passes and is wired into `npm test`.
3. All 40 pages render in **both** themes — walked, not sampled (§8).
4. Status badges are legible in light mode on every surface that shows one.
5. Focus rings are visible on both grounds — this is 20 `ring-voltage` uses
   that are currently invisible on Bone.
6. Both admin charts are legible in both themes, series included.
7. The tour overlay and card are legible in both themes.
8. The three skeletons are visible against `surface` in both themes.
9. `--shadow-card` has a light variant and does not read as a smudge on Bone.
10. `SkillsInput`'s `surface` prop is gone; the field chrome exists once.
11. `CLAUDE.md` and `DESIGN.md` carry one surface rule and one four-pair
    colour pattern — no stacked carve-outs.
12. `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`,
    `npm test`.

## Manual test plan

The brief asks for every route, not a sample, and it is right — a rename fails
one file at a time. 40 pages, both themes.

- **Builder:** `/dashboard`, `/dashboard/new`, `/dashboard/missions`,
  `/dashboard/feedback`, `/dashboard/[id]`, `/dashboard/[id]/edit`,
  `/dashboard/[id]/mission/new`, `/dashboard/[id]/mission/[id]`, `…/edit`.
- **Tester:** `/explore`, `/explore/missions`, `/explore/project/[id]`,
  `/mission/[id]`, `/tester`.
- **Admin:** all eight under `/admin`.
- **Shared:** `/settings`, `/choose-account`, `/terms-accept`,
  `/verify/[role]`.
- **Per screen:** every status badge, every focus ring reached by Tab, every
  empty state, every skeleton (throttle the network to see them).
- **Specifically:** a submission with a `fail` and a `blocked` entry, which is
  where `danger-ink` and `info-ink` both appear at once.

## Commit sequence

1. `feat(theme): add success-ink and info-ink, and a light shadow`
2. `feat(theme): set data-theme once, on the document`
3. `refactor(theme): swap surface, text and line tokens app-wide`
4. `refactor(theme): swap accent, status and ring tokens app-wide`
5. `refactor(theme): theme the charts, tours and skeletons`
6. `refactor(ui): collapse the duplicated field chrome`
7. `test(theme): assert no literal surface or accent token survives`
8. `docs: one surface rule, one colour pattern`

Commits 3 and 4 are split deliberately: 3 is safe and mechanical, 4 is where
every invisible-in-light bug would have been. Splitting them means a bisect
lands on the right one.

## Open questions

None blocking. One thing I will flag rather than decide silently: **if a screen
turns out to be laid out for a dark ground** — a panel that only reads because
everything around it is near-black — I will note it in the PR and leave the
layout alone, because a rename PR that also redesigns screens is the diff this
PR exists to avoid.
