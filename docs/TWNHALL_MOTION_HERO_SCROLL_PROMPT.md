# Twnhall — Motion Pass 2: The Hero Window Rises on Scroll — Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

The homepage hero has two parts: the copy ("Not feedback. A test report.", the
line under it, and the two actions), and below it the product window,
`HeroDemo`. Today the window is just the next thing down the page. It fades up
16px once (`whileInView`) and after that it scrolls like any other block.

The reference is **github.com's homepage hero**. The founder recorded it
scrolling. Frame by frame it does this:

1. **At rest**, the copy sits in the first screen and the top edge of the
   product window **peeks in at the bottom**, with its glow showing. It is a
   promise of what is below.
2. **As you scroll**, the copy **stays pinned**. It does not scroll up, and it
   **fades out** as you go.
3. The window **rises at normal scroll speed and slides over the copy**, which
   shows faintly through the glow and then disappears under the window.
4. Scrolling back up plays all of it in reverse. The motion is tied to the
   scroll position, not played once on a timer.

Build that for Twnhall. The copy, the window and the demo inside it don't
change. Only how they arrive does.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions.
2. Read `DESIGN.md` §6.1, §7.2, §9 and §10, and `TEST.md` §1.
3. Read `app/(public)/page.tsx` (the hero section and the `rise`/`still`
   logic), `HeroDemo` and `Window` in `components/public/HomeMockups.tsx`,
   `.th-glow` in `app/globals.css`, and `components/public/PublicHeader.tsx`
   (64px sticky header, `static` below 480px of height).
4. Read `docs/specs/SPEC-m3-mobile-homepage.md`. It set the hero's current
   sizes, and nothing here may undo its compact rules.

Write the spec into `docs/specs/SPEC-motion-hero-scroll.md` first and **stop for
approval before implementing.** All four gates must pass before you are done:
`npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`,
`npm test`.

**Branch:** `feat/motion-hero-scroll`
**Migration:** none
**New dependencies:** none. Framer Motion is already on this page. Use
`useScroll` + `useTransform`. Motion values update without React re-renders,
and they work in every browser. CSS `animation-timeline` would be simpler, but
it is still missing in Firefox, so don't use it.

---

# 1 — The choreography

## 1.1 — At rest (scroll 0)

- The hero fills the first screen below the header:
  `min-h-[calc(100svh-4rem)]`. Use `svh`, not `vh` or `dvh`, so the phone
  address bar showing or hiding doesn't make the layout jump mid-scroll.
- The copy is centred in the space **above the peek**.
- The window's top edge shows **96px on compact, 128px on medium, 160px from
  lg**, glow included. The title bar and a sliver of the content show, and
  they must clear the actions by at least 24px.
- At every width in §4, the whole copy and both actions are visible without
  scrolling. If a size class can't fit both, shrink the peek first. Never
  push an action below the fold.

## 1.2 — Scrolling

Define **progress** `p` from 0 to 1. `p = 0` at rest. `p = 1` when the window's
top edge reaches the pinned copy's top edge, i.e. the window fully covers it.
Get this from `useScroll({ target, offset })` on the hero section. Choose the
offsets in the spec and explain them.

| Piece | Behaviour over `p` |
|---|---|
| **Copy** | `position: sticky` just under the header (`top-16`). Opacity **1 → 0 over p 0.1 → 0.7**. Scale **1 → 0.96**. No vertical movement. It stays put, like the reference. |
| **Window** | Normal document flow, scrolling at native speed. It sits **above** the copy (`relative z-10`) and is opaque (`bg-surface-raised` already is), so it really covers the text rather than mixing with it. Optional, and only if it reads well: scale **0.96 → 1** over p 0 → 0.5, origin top centre. Put this in the spec, and don't add it if it fights the reference. |
| **Glow** (`.th-glow`, dark theme only) | Opacity **0.6 → 1** over p 0 → 0.5, so the halo blooms as the window arrives. In the light theme there is no glow, and that stays true. |

Easing: `useTransform` is linear against scroll. That is correct for
scroll-linked motion, because the user's thumb is the easing. **Don't** add
springs (`useSpring`) to the copy or the window. A lagging spring is what
makes scroll effects feel like the page is fighting you.

## 1.3 — After the cover

Once the window has fully passed over the copy, the sticky copy is released
at the section's bottom edge and leaves with it. The section must end after
the window plus its current bottom padding, so the next section (`#tour`)
starts exactly as it does today, with the same `border-t`.

## 1.4 — The demo starts when it arrives

Today `HeroDemo` autoplays from 600px as soon as it mounts. By the time
someone scrolls to it, the story is already mid-scene. Add an
`IntersectionObserver` so that, **from 600px, playback starts at scene 01 the
first time the window is ≥ 50% visible**. After that it keeps its current
behaviour: Play/Pause, swipe and jump all unchanged. Compact stays idle until
pressed, as today. Reduced motion stays on the finished report, as today.

---

# 2 — Constraints

- **Keep `overflow-x-clip` on the hero section.** Don't change it to
  `overflow-hidden`: that creates a scroll container and silently kills
  `position: sticky`. Write this as a code comment beside the class.
- **The load entrance stays.** The copy's staggered fade-up on page load is
  `DESIGN.md` §9 ("Landing page load") and runs as today. **Remove only the
  window's `whileInView` rise.** The scroll motion replaces it, and two
  animations on one element fight.
- **Transform and opacity only.** No animating `top`, `height`, `filter` or
  `blur`. They repaint every frame on a mid-range Android phone.
- **Clicks and focus.** Once the window covers the copy, the copy's links are
  under it, so pointer clicks land on the window. That is correct. Keyboard
  focus on "See how it works" while it is covered: the browser will try to
  scroll it into view, and since it is sticky it is always "in view". Check
  what actually happens. If the focused link is invisible under the window,
  that fails WCAG 2.4.11 (Focus Not Obscured). Fix it, for example by
  scrolling back to the top of the hero on focus within the copy. Report what
  you chose.
- **The header's "Get started"** stays the page's one Voltage fill. Nothing
  here adds one.
- **No new tokens** unless the spec argues for one. The existing
  `ease-standard` doesn't apply to scroll-linked motion (see §1.2).

## 2.1 — When the effect is off

Fall back to **today's static layout** (copy, then the window below with its
current margins and no pin, fade or peek requirement) when any of these hold:

- **Reduced motion** (`useReducedMotion()`, which the page already reads as
  `still`).
- **Short viewports**, `max-height: 479px`: phone landscape, where the header
  itself turns `static`. Pinning copy in 390px of height leaves nowhere to
  scroll the window into. Use the same media query as the header so the two
  agree.
- **No JS before hydration.** The server-rendered HTML must be the static
  layout, or close enough that hydration causes no visible jump. The page is
  `"use client"` but is still SSR'd. Check the first paint with the cache
  disabled and record it.

---

# 3 — Docs

Add rows to `DESIGN.md` §9:

| Interaction | Animation | Duration | Easing |
|---|---|---|---|
| Hero scroll | Copy pins and fades; product window rises over it | Scroll-linked | Linear to scroll |
| Hero demo start | Plays from scene 01 when ≥50% in view (≥600px) | — | — |

Also add a line under §9's "No infinite animations" rule: **scroll-linked
motion is not looping motion.** It only moves when the reader moves.

---

# 4 — Acceptance

- [ ] At rest at **1440 × 900, 1280 × 800, 1024 × 768, 768 × 1024, 390 × 844
      and 360 × 800**, both themes: the whole copy and both actions are
      visible, and the window peeks 96/128/160px with no overlap.
- [ ] Scrolling down: the copy stays put and fades; the window slides over
      it; in dark, the glow blooms. Scrolling up reverses it exactly.
- [ ] No jank at 4× CPU throttle in Chrome DevTools (Performance panel: no
      long frames from layout or paint during the scroll).
- [ ] Real Android (Chrome) and real iPhone (Safari): no jump when the
      address bar hides or shows mid-scroll.
- [ ] 844 × 390 landscape: today's static layout, no pin.
- [ ] Reduced motion on (Windows: Settings → Accessibility → Visual effects →
      Animation effects off): today's static layout, no pin, no fade.
- [ ] From 600px, the demo starts at scene 01 when it first comes half into
      view, not on page load.
- [ ] Tab from the header into the hero after scrolling: the focused link is
      never hidden under the window.
- [ ] `#tour` ("See how it works") still lands with the section heading
      under the header, not under the hero window.
- [ ] Lighthouse CLS on `/` is not worse than `main`.
- [ ] Every section below the hero is pixel-identical to `main`.
- [ ] All four gates.
- [ ] Attach a screen recording at 1440 × 900 and 390 × 844 to the PR, next
      to the GitHub reference.

## Commit sequence

1. `refactor(home): give the hero copy and window their own wrappers`
   (no visible change)
2. `feat(home): pin the hero copy and rise the window over it on scroll`
3. `feat(home): bloom the hero glow with the window` (dark only)
4. `feat(home): start the hero demo when it scrolls into view`
5. `fix(home): keep focus in the hero copy visible` (if needed, see §2)
6. `docs(design): hero scroll rows in DESIGN.md §9`
