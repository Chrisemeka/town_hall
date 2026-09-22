# SPEC: Public Theme System and Shell

**Status:** Awaiting approval
**Branch:** `feat/public-theme`
**Depends on:** None
**Blocks:** `feat/public-pages` (PR 2), `feat/email-password-auth` (PR 3)
**Source:** `docs/TWNHALL_UI_REVAMP_STAGE1_PROMPT.md` — PR 1
**Migration:** none

## Summary

Introduce a `(public)` route group with its own layout, a semantic colour-token
layer that resolves per theme, a cookie-backed light/dark switch defaulting to
light, and a shared public header and footer. Move `app/page.tsx`, `app/terms`
and `app/privacy` into the group and convert their hardcoded light-mode literals
to the semantic tokens. `(developer)`, `(tester)` and `(admin)` are not touched.

## Why

Stage 1 of the UI/UX revamp needs somewhere to put six new public pages (PR 2)
and four new auth pages (PR 3). Today every public page carries its own nav,
its own footer and its own hardcoded `bg-bone text-midnight` — three copies
already, ten after Stages 2 and 3. The shell and the token layer are what make
the later PRs small.

Theme switching is a public-surface feature. The dashboard stays dark.

## Non-goals

Explicitly out of scope. Do not build them in this PR.

- **Dashboard, tester and admin theming.** The ~60 app components keep their
  literal tokens (`bg-obsidian`, `text-chalk`, `border-iron`) and stay dark in
  both themes. This is the decision that keeps the PR small — respect it.
- **`prefers-color-scheme` support.** See §4.
- **Any new public page.** `/pricing`, `/guides`, `/about`, `/contact` are PR 2.
  This PR ships no link to any of them (§6).
- **`/login`, `/signup`** — PR 3. The header keeps today's single
  "Continue with Google" button until those routes exist.
- **Mobile ≤480px beyond the new shell.** Logged debt, out of scope.
- **Redesigning the landing page content.** This PR re-themes it and removes
  its bespoke nav/footer. The sections themselves are untouched.

## §1 — The CLAUDE.md rule this replaces

`CLAUDE.md` § Design System currently reads:

> **Surfaces:** Dashboard is dark (Obsidian `#0E0E10` base). Landing is light
> (Bone `#F5F5F7`). Do not mix.

That rule is now scoped to app surfaces. Replace it — do not leave the old
wording alongside the new one — with:

> **Surfaces:** App surfaces (dashboard, tester, admin) are dark, Obsidian
> `#0E0E10` base, and use the literal palette tokens. Public surfaces (the
> `(public)` route group) are theme-switchable and use the semantic token layer
> (`surface`, `surface-raised`, `ink`, `ink-muted`, `line`, `accent`,
> `accent-ink`). Never use a semantic token on an app surface. A literal on a
> public surface must be a deliberate inversion that reads in both themes, and
> must say so in a comment — the dark icon chips on the landing page are the
> precedent.

Mirror the same paragraph into `DESIGN.md` §4.1, together with §3's accent rule
and §5's typography exception.

## §2 — Route group

```
app/
  (public)/
    layout.tsx          theme attribute + header + footer
    page.tsx            moved from app/page.tsx
    terms/page.tsx      moved from app/terms/page.tsx
    privacy/page.tsx    moved from app/privacy/page.tsx
```

A route group changes no URL: `/`, `/terms` and `/privacy` keep their paths.
`app/guidelines` stays where it is — PR 2 replaces it with `/guides` and a
permanent redirect, and moving it now would mean moving it twice.

**The three moved pages each render their own `<nav>`/`<header>` and the landing
page renders its own `<footer>`. Those are deleted, not kept** — otherwise every
public page renders two headers. That deletion is most of this PR's diff and is
the reason the prompt's "no existing component touched" note is optimistic: no
*app* component is touched, but all three public pages are edited.

## §3 — Tokens

Every existing literal token in `app/globals.css` stays exactly as it is. The
dashboard reads them by name and they must not move or be renamed.

**Add** below them, inside the same `@theme` block — the light values, which are
also the defaults:

```css
  /* Semantic layer — public surfaces only. See CLAUDE.md § Design System. */
  --color-surface:        #F5F5F7;   /* Bone */
  --color-surface-raised: #FFFFFF;
  --color-ink:            #0E0E10;   /* Obsidian */
  --color-ink-muted:      #5A5A66;
  --color-line:           #E2E2E8;
  --color-accent:         #E8FF47;   /* Voltage — fills only */
  --color-accent-ink:     #353D00;   /* Forest — text, borders, icons */
```

and one unlayered block outside it for the dark values:

```css
[data-theme="dark"] {
  --color-surface:        #0E0E10;   /* Obsidian */
  --color-surface-raised: #1A1A1F;   /* Graphite */
  --color-ink:            #F0F0F2;   /* Chalk */
  --color-ink-muted:      #8A8A99;   /* Ash */
  --color-line:           #2C2C35;   /* Iron */
  --color-accent:         #E8FF47;   /* Voltage */
  --color-accent-ink:     #E8FF47;
}
```

**This deliberately drops the `--th-*` indirection layer the prompt sketched,
and it is not a style preference — the sketch does not work here.** A custom
property is substituted at computed-value time on the element that *declares*
it. `@theme` declares `--color-surface` on `:root`, so `--color-surface:
var(--th-surface)` resolves against `:root`'s `--th-surface` once and inherits
down as a literal; a `[data-theme="dark"]` block on a nested `<div>` would
change `--th-surface` for that subtree and `--color-surface` would not notice.
The indirection only works when `data-theme` sits on `:root` itself — which §4
explains we are not doing. Defining `--color-*` directly means the dark block
overrides the same property the utilities read, which inherits normally from any
element. (Tailwind's `@theme inline` is the other way out; one layer fewer beats
one directive fewer.)

Cascade: Tailwind wraps its output in `@layer theme`, and unlayered CSS beats
layered CSS regardless of order, so the `[data-theme="dark"]` block wins over
`@theme`'s `:root` declarations without needing `!important` or a specificity
bump. `[data-theme="light"]` needs no block of its own — it inherits the
defaults.

Two new literals enter the palette: `#5A5A66` (light muted ink) and `#E2E2E8`
(light line). Add both to `DESIGN.md` §4.1's table.

### 3.1 — The accent rule that makes light mode work

**Voltage `#E8FF47` on Bone `#F5F5F7` computes to 1.02:1. It is invisible.**
`DESIGN.md` requires ≥7:1 for body and ≥4.5:1 for large text and labels, so
Voltage can never be accent *text* on a light ground.

Forest `#353D00` — already in the palette — computes to **10.6:1 on Bone**.

So, in light mode:

- **Voltage is a fill only**, always carrying Obsidian text (17.3:1). Buttons,
  badges, highlight blocks.
- **Forest is the accent ink** — links, small-caps labels, icons, focus rings,
  active borders.
- In dark mode both collapse back to Voltage, exactly as today.

This single rule decides whether light mode looks designed or broken. It goes
into `DESIGN.md` §4.1 verbatim.

### 3.2 — Computed contrast for every new pairing

Computed by the WCAG 2.x relative-luminance formula; re-check each at WebAIM
before the PR merges, per `DESIGN.md`.

| Pairing | Light | Dark | Tier |
|---|---|---|---|
| `ink` on `surface` | 17.7:1 | 16.9:1 | body ≥7 ✓ |
| `ink` on `surface-raised` | 19.3:1 | 15.2:1 | body ≥7 ✓ |
| `ink-muted` on `surface` | **6.3:1** | **5.7:1** | labels ≥4.5 ✓, body ≥7 ✗ |
| `accent-ink` on `surface` | 10.6:1 | 17.3:1 | body ≥7 ✓ |
| Obsidian on `accent` fill | 17.3:1 | 17.3:1 | body ≥7 ✓ |
| `line` on `surface` | 1.19:1 | 1.40:1 | decorative only |

> Two of these disagree with figures already printed in `DESIGN.md` §4.1
> (Chalk-on-Obsidian "≈14.5:1", Voltage-on-Obsidian "≈13.5:1"). Recomputing
> both by the WCAG formula gives 16.9:1 and 17.3:1. Both old figures are
> conservative, so nothing shipped is failing — but they are wrong, and the
> docs commit corrects them rather than leaving two sources of truth.

Two consequences, both binding:

1. **`ink-muted` is for labels, metadata and captions — never for a paragraph.**
   At 6.3:1 in light mode it misses the 7:1 body bar. Long-form prose on public
   pages uses `ink`. (Today's landing page sets body copy in `text-midnight/70`,
   which blends to 7.0:1 on Bone — it scrapes the bar by a hundredth.
   `ink-muted` would not. Convert body copy to `ink`, not `ink-muted`.)
2. **`line` is a decorative divider, not a control boundary.** WCAG 1.4.11 wants
   3:1 for the visible boundary of a control; `#E2E2E8` on Bone is 1.19:1. Form
   inputs and other bounded controls on public surfaces take
   `border-ink-muted` (6.3:1 light, 5.7:1 dark). No new token — the value
   already exists. PR 2's contact form and PR 3's auth forms depend on this
   line; it is written here so they do not each re-derive it.

## §4 — Theme switching

**Default light. An explicit choice wins. There is no `prefers-color-scheme`
fallback, deliberately** — the requested default is light, and deferring to the
OS would make the default unpredictable across visitors. Do not "fix" this
later by adding a media query; `:root` with no `data-theme` is light on purpose.

**The choice is a cookie, not `localStorage`.** `th_theme`, value `light` or
`dark`, one year, `SameSite=Lax`, not `HttpOnly` (the toggle writes it from the
client), no `Secure` flag needed for localhost parity — it carries no authority.
A cookie can be read during SSR, so `data-theme` is rendered server-side on the
first byte: no flash of the wrong theme, no blocking inline script, no
`suppressHydrationWarning`. `localStorage` cannot do that without a flash.

**The attribute is rendered by `app/(public)/layout.tsx` onto its own root
element, not onto `<html>.`** Only the root layout may render `<html>`, and
reading `cookies()` there would opt *every* route in the app into dynamic
rendering — including `/terms` and `/privacy`, which are static today. Scoping
the read to the `(public)` layout keeps that cost on the pages that need it and
keeps the app tree untouched. CSS custom properties cascade, so an attribute on
a wrapper `<div>` resolves for everything inside it.

The wrapper carries `min-h-screen bg-surface text-ink`. The root `<body>` keeps
its literal `bg-obsidian text-chalk` — unchanged, because the app surfaces still
rely on it. Overscroll past the end of a light public page therefore shows
Obsidian, which is exactly what today's landing page already does.

**The toggle** (`components/public/ThemeToggle.tsx`) is a Client Component:
writes `document.cookie`, calls `router.refresh()`. No server action — a UI
preference is not a trust boundary, and the layout validates it on read
(`value === "dark" ? "dark" : "light"`), so a hand-edited cookie can only ever
resolve to one of two known strings.

Accessibility: a real `<button>` with `aria-label` reading "Switch to dark
theme" / "Switch to light theme" (the *destination*, not the current state),
`aria-pressed` omitted (it is not a toggle button in the pressed sense — it is
an action), a sun/moon `lucide-react` icon, 40×40px, and the standard
`:focus-visible` ring from `DESIGN.md` §10 with `ring-offset-surface`.

## §5 — Typography

Per §1.6 of the prompt, raised and **decided: add one sans for long-form public
prose only.**

| Role | Font | Where |
|---|---|---|
| Display / headings | Syne Bold 700 | everywhere — unchanged |
| UI, labels, buttons, badges, code, metadata | DM Mono 400/500 | everywhere — unchanged |
| Paragraph and long-form prose | **DM Sans 400/500** | `(public)` group only |

DM Sans is chosen over any other sans because it is DM Mono's own superfamily:
shared design, shared vertical metrics, so the mixed setting on a pricing table
or a guide does not visibly shift baseline. It loads through `next/font/google`
alongside the two existing faces in `app/layout.tsx`, exposed as
`--font-dm-sans` and mapped to `--font-sans` in `@theme`. Two weights, latin
subset only: ~15KB.

**App surfaces do not get it.** DM Mono remains the body font everywhere inside
`(developer)`, `(tester)` and `(admin)`. `DESIGN.md` §4.2 records the exception
in one line, scoped the same way the surface rule is.

## §6 — Header and footer

`components/public/PublicHeader.tsx`, `components/public/PublicFooter.tsx`.
Both Server Components; the theme toggle and the mobile sheet are the only
client pieces.

**Header.** 64px, sticky, `bg-surface/85 backdrop-blur-md`, bottom border
`line`. Left: `Logo` + Syne wordmark. Right: nav, theme toggle, CTA.

At PR 1 the nav is **empty** — Pricing, Guides and About do not exist until
PR 2, and the prompt's own rule is never to ship a link to a page that does not
exist. The CTA stays today's single `signInWithGoogle` form button; the
Sign in / Get started pair arrives in PR 3 with `/login` and `/signup`. Both
are one-line additions to an array in the component, done in the PR that
creates the destination.

Mobile: **no sheet in this PR.** With an empty nav a hamburger would hide two
controls that are already on screen — speculative scaffolding for links that do
not exist yet. The header at 360px is logo + wordmark + toggle + CTA, which fits
once the CTA label shortens to "Sign in" below 640px (the full label needs
~200px it does not have). PR 2 adds the sheet along with the links that justify
it: hamburger with `aria-expanded`/`aria-controls`, focus moved into the panel
on open and returned to the trigger on close, `Esc` to close, tap targets
≥44×44px.

**Footer.** Four columns on ≥1024px, two on ≥640px, one below. `bg-surface`,
top border `line`. Columns and their contents *at the end of PR 2* — the target
shape — with the PR 1 state marked:

| Brand | Product | Guides | Company & legal |
|---|---|---|---|
| Logo, "Ship with confidence. Test each other.", "Made in Nigeria 🇳🇬" | Pricing *(PR 2)*, About *(PR 2)* | For builders *(PR 2)*, For testers *(PR 2)*, Get started *(PR 3)* | Contact *(PR 2)*, Privacy policy, Terms of service, Sign in |

At PR 1 the Product and Guides columns have no live destination, so the footer
renders three columns: Brand, a Guides column holding the existing
`/guidelines` link, and Company & legal holding Privacy policy, Terms of
service, a `mailto:twnhallhq@gmail.com` contact line and the Google sign-in.
PR 2 adds Product, swaps `/guidelines` for `/guides/builder` and
`/guides/tester`, and points Contact at `/contact`.

No Features, Download or Blog column. Twnhall has none of those pages.

Bottom row: `© <year> Twnhall. All rights reserved.` in DM Mono 12px
`ink-muted`.

## §7 — Converting the three moved pages

Mechanical, and the only part of this PR that touches existing markup. The full
substitution list:

| From | To |
|---|---|
| `bg-bone` | `bg-surface` |
| `bg-white` | `bg-surface-raised` |
| `text-midnight` | `text-ink` |
| `text-midnight/70`, `/60` (body copy) | `text-ink` |
| `text-midnight/70`, `/60` (labels, metadata) | `text-ink-muted` |
| `border-midnight/10` | `border-line` |
| `bg-voltage text-obsidian` (fills) | `bg-accent text-obsidian` — unchanged in effect, renamed for intent |
| Voltage used as *text* or *border* | `text-accent-ink` / `border-accent-ink` |
| paragraph `font-mono` | `font-sans` |
| the page's own `<nav>` / `<header>` / `<footer>` | deleted — the layout owns these |

`app/page.tsx` stays a Client Component (Framer Motion). Its two
`// eslint-disable-next-line @typescript-eslint/no-explicit-any` variant casts
stay as they are — untangling Framer's types is not this PR's job and removing
the disable would add a lint error, not remove one.

Its in-page anchors (`#how-it-works`, `#community`) move from the deleted nav
into nothing — the header nav is empty at PR 1. They were nav links to sections
on the same page; the sections stay, the links go. PR 2 decides whether the
marketing nav wants them back.

## §8 — Files

**New**

```
app/(public)/layout.tsx
components/public/PublicHeader.tsx
components/public/PublicFooter.tsx
components/public/ThemeToggle.tsx
lib/theme.ts                      THEME_COOKIE, Theme type, readTheme(value)
scripts/theme.test.mts            see §10
```

**Moved**

```
app/page.tsx          → app/(public)/page.tsx
app/terms/page.tsx    → app/(public)/terms/page.tsx
app/privacy/page.tsx  → app/(public)/privacy/page.tsx
```

Move with `git mv` so the diff reads as a rename plus edits, not a delete plus
an add.

**Edited**

```
app/globals.css       semantic layer added, literals untouched
app/layout.tsx        DM Sans added to the font trio
CLAUDE.md             § Design System surface rule (§1), folder layout
DESIGN.md             §4.1 tokens + accent rule, §4.2 font exception, §5 shell
```

**Untouched:** `middleware.ts`, `lib/access.ts`. `/`, `/terms` and `/privacy`
are already public and already reachable — a route group changes no URL, so
neither file has anything to learn in this PR. PR 2 extends both.

## §9 — Design conformance

- All spacing divisible by 4 (`DESIGN.md` §4.3). Header 64px, footer padding
  64px top / 48px bottom, column gap 32px.
- Max width 1200px, `px-6` mobile → `px-8` desktop (§4.4).
- One Voltage CTA per viewport (§7.2): the header's sign-in button is it on
  every public page. The landing page's existing in-page CTAs are pre-existing
  and out of scope — flagged, not fixed, here.
- Focus-visible ring on every interactive element, `ring-offset-surface`
  (§10).
- Colour never conveys state alone (§10) — the theme toggle carries an
  `aria-label` naming its destination, not just an icon swap.
- Tap targets ≥44×44px on mobile (§10).

## §10 — Tests

`TEST.md` §1's pattern is Vitest for server actions and a plain
`node --experimental-strip-types` script for pure logic. This PR adds no server
action, so it adds one pure-logic script, matching `scripts/access.test.mts`:

`scripts/theme.test.mts` asserts `readTheme()`:

| Input | Expected |
|---|---|
| `"dark"` | `"dark"` |
| `"light"` | `"light"` |
| `undefined` (no cookie) | `"light"` — the default |
| `""` | `"light"` |
| `"DARK"` | `"light"` — exact match only |
| `"light; --data-theme=dark"` (injection shape) | `"light"` |

Wire it into the `test` script in `package.json` alongside the existing five.

Everything else in this PR is markup with no branching logic, and `TEST.md`
does not ask for render tests. The theme round-trip is covered by the manual
plan below and by a QA row in `TownHall_Checklist (1).xlsx`.

## Acceptance criteria

1. `(public)` route group exists with a layout; `/`, `/terms` and `/privacy`
   resolve at the same URLs as before, with no `(public)` segment in any path.
2. The semantic token layer is in `app/globals.css`; **every pre-existing
   literal token is byte-identical**; the dashboard renders unchanged.
3. `data-theme` is rendered server-side from the `th_theme` cookie. First paint
   in either theme shows no flash of the other. Verified with JS disabled.
4. No cookie → light. `th_theme=dark` → dark. Any other value → light.
5. The toggle switches theme, persists across a full reload, and across a
   navigation between `/`, `/terms` and `/privacy`.
6. `/dashboard`, `/explore`, `/tester`, `/mission/*` and `/admin` render
   identically with `th_theme=dark` and with `th_theme=light`.
7. Public header and footer render once per public page — the three moved pages
   render no nav or footer of their own.
8. The footer links only to pages that exist: `/terms`, `/privacy`,
   `/guidelines`, a `mailto:`, and the Google sign-in. No dead link, no `href="#"`.
9. Both themes are correct on all three public pages at 360px, 768px and
   1440px. No horizontal scroll at 360px.
10. Every new colour pairing is verified at WebAIM and matches §3.2's table.
11. DM Sans applies to public paragraph text only; DM Mono remains the body
    font on every app surface.
12. The header is usable at 360px with no horizontal scroll and no hamburger —
    the sheet arrives in PR 2 with the links that need it.
13. `scripts/theme.test.mts` passes and is wired into `npm test`.
14. `npx tsc --noEmit` — zero errors.
15. `npm run lint` — passes, no new `as any`.
16. `npm run build` — succeeds; `/terms` and `/privacy` may change from static
    to dynamic, which is expected and noted in the PR description.
17. `CLAUDE.md` and `DESIGN.md` carry the replaced surface rule, the accent
    rule and the font exception. The old "Do not mix" wording appears nowhere.

## Manual test plan

**After the tokens commit**
- `/dashboard` and `/explore` are pixel-identical to `main`. Diff a screenshot.
- Temporarily set `data-theme="dark"` on `<html>` in devtools while on
  `/dashboard`: nothing changes. That is the proof the app surfaces are
  insulated from the semantic layer.

**After the layout + toggle commit**
- Load `/` with no cookie → light. Hard-reload with JS disabled → still light,
  no flash.
- Toggle to dark → reload → still dark. Navigate `/` → `/terms` → `/privacy`
  → still dark on each.
- Edit the cookie to `th_theme=purple` → light, no error.
- Tab to the toggle → visible focus ring. Activate with `Enter` and `Space`.
- Screen reader announces "Switch to dark theme" on a light page.

**After the header/footer commit**
- Every footer link opens a real page. Click all of them.
- 360px: hamburger appears, sheet opens, `Esc` closes, focus returns.
- 1440px: header and footer align to the 1200px content column.

**After the page-conversion commit**
- All three public pages in both themes at all three widths.
- Landing page Framer animations still run, and respect
  `prefers-reduced-motion`.

## Commit sequence

Per `CLAUDE.md` — small commits, reviewable in order, not squashed.

1. `feat(public): add semantic colour tokens for the public theme`
2. `feat(public): add DM Sans for long-form public prose`
3. `feat(public): add the theme cookie helper`
4. `feat(public): add the theme toggle`
5. `feat(public): add the public route group, header and footer`
6. `refactor(public): move the landing, terms and privacy pages into the group`
7. `refactor(public): convert the moved pages to semantic tokens`
8. `test(public): cover theme cookie resolution`
9. `docs: scope the surface rule to app surfaces, record the accent rule`

The layout lands with the header and footer it renders rather than two commits
earlier, so every commit in the sequence builds on its own.

## Open questions

None. §1.6's typography question was raised and answered before this spec was
written: one sans, DM Sans, public prose only (§5).
