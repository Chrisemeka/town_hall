# SPEC: Motion Pass 2 — The Hero Window Rises on Scroll

**Status:** Implemented 2026-10-17. §6 confirmed in Chrome before the fix:
after scrolling, Tab focused both hero links under the window and scrolled
nothing. The demo's start uses Framer's `useInView` (an IntersectionObserver,
already used in `HomeMockups`) rather than a hand-rolled one
**Branch:** `feat/motion-hero-scroll`
**Base:** `main`
**Source:** `docs/TWNHALL_MOTION_HERO_SCROLL_PROMPT.md`
**Migration:** none
**New dependencies:** none. Framer Motion (`useScroll`, `useTransform`,
`useMotionValue`) is already on the page.
**Risk:** low. Only the hero section and `HeroDemo` change. Every section from
`#tour` down is untouched.

## Summary

At rest, the hero copy is centred in the first screen and the product window's
top edge peeks in below it. As the reader scrolls, the copy holds still and
fades, and the window scrolls up at native speed over it. Scrolling back
reverses this exactly. From 600px, the demo starts at scene 01 the first time
it's half in view, not on page load.

## §1 — Measured today (`main`, headless Chrome)

| Viewport | Copy block (h1 → actions) | Window top | Available above a peek |
|---|---|---|---|
| 1440 × 900 (lg) | 344px | 584 | 900 − 64 − 160 = **676** |
| 1280 × 800 (lg) | 344 | 584 | **576** |
| 1024 × 768 (lg) | 344 | 584 | **544** |
| 768 × 1024 (medium) | 296 | 488 | 1024 − 64 − 128 = **832** |
| 390 × 844 (compact) | 332 | 484 | 844 − 64 − 96 = **684** |
| 360 × 800 (compact) | 332 | 484 | **640** |

The copy plus 48px of clearance (24px above, 24px below) fits at every
acceptance size with ≥ 150px to spare. No size class needs a smaller peek.

**"Shrink the peek first" happens on its own.** The copy region has a
*minimum* height of `100svh − 4rem − peek` and grows to fit the copy. When a
viewport is too short for both, the region grows and pushes the window down,
so the peek shrinks and the actions stay put. The actions only leave the
first screen when `vh − 64 < copy + 24`, which is below about 410px. That is
inside the short-viewport fallback (§5), where none of this applies.

## §2 — Structure

```
<section overflow-x-clip>            ← kept; a comment says why (no overflow-hidden)
  <div container, px-*, pb-*>         ← top padding moves into the region
    <motion.div region>               ← NEW wrapper: sticky top-16, min-h, centres the copy,
                                         style={{ opacity, scale }}
      <motion.div {…rise} stagger>    ← unchanged: the load entrance (Design.md §9)
        h1 / p / actions              ← unchanged
    <div window relative z-10>        ← whileInView rise REMOVED; static margins kept for the fallback
      <HeroDemo glow={glowOpacity} />
```

`position: sticky` sits on the region, and its containing block is the
container: the region plus the window plus the bottom padding. So the copy
holds until the container's bottom edge reaches it, and then leaves with it
(prompt §1.3). The section's height doesn't change from today's. `#tour`
starts in the same place, with the same `border-t`.

**Why the region and not the copy itself.** The region fills the space above
the peek, which is what lets the copy centre in it. Scaling the region scales
about its centre, which is roughly the copy's centre.

## §3 — The layout lives in CSS; only the motion is JS

This is what keeps hydration from moving anything (prompt §2.1, "no JS before
hydration").

One custom variant in `app/globals.css`:

```css
/* The hero's scroll layout (SPEC-motion-hero-scroll): on only where it can
   work — motion allowed, and tall enough that the header is still sticky. */
@custom-variant hero-scroll (@media (prefers-reduced-motion: no-preference) and (min-height: 480px));
```

- The variant carries the pin, the minimum height and the peek: `sticky
  top-16`, `min-h-[calc(100svh-4rem-96px)]` (128px from `medium:`, 160px
  from `lg:`), `py-6` for the 24px clearance, and zero top margin on the
  window.
- Without the variant, today's padding and margins apply unchanged. That's
  the static layout.
- The variant is pure CSS, so the server-rendered HTML already has the right
  layout for the reader's settings. Hydration adds only inline
  `opacity`/`scale`, and at `p = 0` those are `1` and `1`, so nothing moves.
- The glow also starts at `hero-scroll:opacity-60` in CSS, so the JS value
  takes over at the same 0.6 rather than snapping from 1.
- `svh`, not `vh`/`dvh`, so the phone address bar showing or hiding doesn't
  change the layout.
- It uses the same `max-height: 479px` boundary as `PublicHeader`'s
  `[@media(max-height:479px)]:static`, so the two always agree.

Variant order: where a `hero-scroll:` utility has to beat a `medium:`/`lg:`
one (the padding, the window margin), it's written compound
(`medium:hero-scroll:mt-0`). That doesn't rely on how Tailwind orders
variants. I'll check the computed styles in the browser at every size class.

## §4 — Progress and the transforms

**`p` from 0 to 1.** `p = 0` at rest. `p = 1` when the window's top edge
reaches the pinned copy's top edge.

The hero is the first thing on the page, so rest is `scrollY = 0`. The window
starts at the region's bottom, and the copy sits centred in the region, so:

```
span = (regionHeight + copyHeight) / 2      // scroll distance to p = 1
p    = clamp(scrollY / span, 0, 1)
```

**Why not `useScroll({ target, offset })`, which the prompt asks for.** I
tried to express this as offsets and it doesn't fit:

- Framer's offset edges take `px`, `%`, `vh` and named edges, but not
  `calc()`. Neither "the region's height" nor "`vh` minus the peek" can be
  written.
- Framer measures the target with `offsetTop`. On a `position: sticky`
  target, that value moves while the target is stuck.

So `p` comes from `useScroll()` (page `scrollY`, no re-renders) and a
`span` motion value. A `ResizeObserver` updates `span` when the region or
copy resizes, from `offsetHeight`, which ignores `scale`. It's combined with
`useTransform([scrollY, span], …)`. That keeps it scroll-linked and
reversible, with no React state per frame.

| Piece | Over `p` | How |
|---|---|---|
| Copy region | opacity 1 → 0 over 0.1 → 0.7; scale 1 → 0.96 over 0 → 1 | `useTransform`, linear |
| Window | none; it scrolls at native speed | `relative z-10`, opaque `bg-surface-raised` (already) |
| Glow | opacity 0.6 → 1 over 0 → 0.5 | `HeroDemo`'s glow becomes a `motion.div` with an optional `glow` prop. It's dark only already, and in light `.th-glow` has no background, so its opacity changes nothing |

- **No window scale.** GitHub's window doesn't scale. A growing window while
  the copy shrinks reads as a zoom, which isn't what the reference does. Left
  out, as the prompt allows.
- **No `useSpring`.** The motion is linear to the scroll, as the prompt says.
- **Transform and opacity only.** Sticky is layout, but it's static layout:
  nothing animates `top` or `height`.

**When the effect is off**, under reduced motion (`useReducedMotion()`, the
page's existing `still`) or a short viewport (`useSyncExternalStore` on
`(max-height: 479px)`, server snapshot "off"), the inline styles aren't
passed. Off is the CSS fallback, so the two can't disagree.

## §5 — When the effect is off

| Condition | CSS layout | JS motion |
|---|---|---|
| `prefers-reduced-motion: reduce` | static: the variant doesn't match | none (`still`) |
| `max-height: 479px` | static: the variant doesn't match | none |
| Before hydration | the scroll layout if the media allow it, no fade | — |

The no-JS case keeps the pin, and the opaque window still slides over the copy
as the reader scrolls. It just doesn't fade. The prompt allows "the static
layout or close enough that hydration causes no visible jump". Rendering the
correct layout from the first byte means there's no jump at all.

## §6 — Focus not obscured (WCAG 2.4.11)

Once the window covers the copy, the copy's links are underneath it. Tabbing
to them doesn't make the browser scroll, because a sticky element is always
"in view". So the focus ring is drawn under an opaque window and nobody can
see it.

**Fix:** an `onFocus` on the region. When the focus is `:focus-visible`
(keyboard, not pointer) and `p > 0`, it calls
`window.scrollTo({ top: 0, behavior: "smooth" })`.

- Limiting it to `:focus-visible` keeps a mouse click on "See how it works"
  from fighting its own `#tour` jump.
- Smooth is safe here: the effect only exists when motion is allowed.

I'll confirm the obscured case exists before adding this (commit 5), and report
what I found.

## §7 — `HeroDemo` starts when it arrives

```ts
const [seen, setSeen] = useState(false)
const running = !still && compact !== null && (playing ?? (!compact && seen))
```

- An `IntersectionObserver` on the demo's root, `threshold: 0.5`, sets `seen`
  once and disconnects. It isn't created on compact or under reduced motion.
- `t` is still `0` when `seen` flips, so playback begins at scene 01.
- Play/Pause, swipe and jump are unchanged. Pressing Play before the window is
  half in view starts it then, as it does today.
- Compact stays idle until pressed. Reduced motion stays on the finished
  report.
- From 600px, the button reads "Play" until the window is half in view, then
  "Pause". That's truthful, because it isn't running yet.

## §8 — What doesn't change

- The copy's text, sizes and compact rules (`SPEC-m3-mobile-homepage.md`), and
  the load entrance stagger.
- The demo's script, scenes, timings and markup.
- The header and its one Voltage fill. Nothing here adds a fill.
- Every section from `#tour` down.
- No new tokens. `ease-standard` doesn't apply to scroll-linked motion.

## §9 — Tests

The scroll and focus behaviour are checked in headless Chrome over CDP, the
way the motion-sheets pass was:

- the six acceptance viewports at rest, in both themes, for peek, clearance
  and both actions visible;
- the scroll positions `p = 0, 0.25, 0.5, 0.75, 1`, and back;
- 844 × 390 and reduced motion, which must be static;
- Tab into a covered link;
- the demo's start.

`npm test` gains one vitest file. The progress arithmetic goes in a pure
`heroProgress(scrollY, regionHeight, copyHeight)` in `lib/heroScroll.ts`,
tested at rest, at the cover point, past the cover point (clamped) and with a
zero height (no divide by zero). That's the one piece of logic that can
silently break.

**Not checkable from here:** a real Android or iPhone, DevTools 4× CPU
throttle frame timing, Lighthouse CLS, and the screen recordings. The PR will
list these as not done.

## §10 — Design.md §9

Two new rows:

| Interaction | Animation | Duration | Easing |
|---|---|---|---|
| Hero scroll | Copy pins and fades; product window rises over it | Scroll-linked | Linear to scroll |
| Hero demo start | Plays from scene 01 when ≥50% in view (≥600px) | — | — |

Plus a line under "No infinite animations": **scroll-linked motion is not
looping motion.** It only moves when the reader moves.

## §11 — Commits

1. `refactor(home): give the hero copy and window their own wrappers`
2. `feat(home): pin the hero copy and rise the window over it on scroll`
3. `feat(home): bloom the hero glow with the window`
4. `feat(home): start the hero demo when it scrolls into view`
5. `fix(home): keep focus in the hero copy visible` (if confirmed, §6)
6. `docs(design): hero scroll rows in DESIGN.md §9`
