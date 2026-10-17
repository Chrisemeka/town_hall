# Twnhall — Motion Pass 1: The Two Sheets — Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

Users call the app "lifeless". This is the first motion pass, and it covers the
two sheets that open from the top bar below 840px:

- **`MobileNav`**: the public site menu, opened by the **hamburger**.
- **`AccountSheet`**: the account menu in the app shell, opened by the **avatar**.

There are two goals:

1. The sheet should arrive and leave, not just appear and disappear.
2. The close button (X) should sit **exactly where the button that opened it
   was**, and the trigger should visibly **turn into** the X: the hamburger
   morphs, the avatar hands off to the X. Closing plays the same motion
   backwards, so the X turns back into the trigger in the same spot.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions.
2. Read `DESIGN.md` §9 (Motion) and §10 (Accessibility), and `TEST.md` §1.
3. Read `components/public/MobileNav.tsx`, `components/layout/AccountSheet.tsx`,
   `components/public/PublicHeader.tsx`, `components/layout/TopNav.tsx`, and the
   `--ease-standard` / `.th-fade-in` blocks in `app/globals.css`.
4. Read `docs/specs/` and match that spec format.

Write the spec into `docs/specs/SPEC-motion-sheets.md` first and **stop for
approval before implementing.** All four gates must pass before you are done:
`npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`,
`npm test`.

**Branch:** `feat/motion-sheets`, from `main` (both sheets are already on `main`)
**Migration:** none
**New dependencies:** none. Do not use Framer Motion for this. The sheets are
native `<dialog>`s and CSS can do the whole thing, entry and exit.

---

# 1 — What is wrong today

## 1.1 — "It just appears"

Both sheets share this class recipe:

```
open:transition-[translate] open:duration-300 open:ease-standard
motion-safe:starting:open:translate-x-full
```

It compiles correctly (`@starting-style` is in the built CSS), so the slide-in
does exist. It still reads as "appears", for three reasons:

- **The scrim pops in at full strength.** `backdrop:bg-obsidian/60` has no
  transition, so 60% black covers the page on the first frame. The darkening is
  the biggest visual change on screen, and it is instant.
- **Closing is instant.** The transition sits under `open:`, so on close the
  dialog jumps straight to `display: none`. Half of every open/close cycle has
  no motion at all.
- **Reduced motion gets nothing at all.** If "Animation effects" is off on
  Windows (or Reduce Motion is on in macOS/iOS), `motion-safe:` removes the
  only motion there is. The sheet snaps open and shut. **Check your own
  machine's setting before judging the result.** Reduced motion should get a
  short fade instead of a slide, not nothing (§3.4).

## 1.2 — The X is somewhere else

- **`MobileNav`**: the hamburger is centred in a 64px bar (`h-16`) with
  `px-4` / `medium:px-6` insets. The X sits in the sheet's `p-4` box, top right,
  so it lands about 8px lower than the hamburger and at a different horizontal
  inset from 600px up.
- **`AccountSheet`**: the avatar is centred in a 56px bar at the trailing edge.
  The X is at the end of the header row, after the avatar and name. It is
  roughly in the right corner, but at a different height.
- **The trigger and the X are unrelated icons**, so nothing connects "I tapped
  this" to "this closes it".

## 1.3 — A bug found while reading (fix it here)

Both sheets live inside a wrapper with `expanded:hidden`. If the viewport
crosses 840px while a sheet is open (rotating a tablet, resizing a desktop
window), the wrapper hides. The `<dialog>` stays modal but is never drawn, so
**the whole page is inert under an invisible modal** until Esc. Close the sheet
when `(min-width: 840px)` starts matching.

---

# 2 — Build one sheet, not two

`MobileNav` and `AccountSheet` already duplicate the `SHEET` string, the
`ICON_BUTTON` string, the `showModal`/`onClose`/scrim-click wiring and the
ponytail comments. This work adds measuring, a morph and exit motion. Doing that
twice is how the two sheets drift apart.

Extract **`components/ui/Sheet.tsx`**, roughly this shape (you finalise it in
the spec):

```tsx
<Sheet
  id="public-nav-sheet"
  label="Site menu"            // dialog aria-label
  openLabel="Open menu"        // trigger aria-label
  closeLabel="Close menu"
  trigger={{ kind: "menu" }}   // or { kind: "avatar", node: <Avatar … /> }
  width="w-[min(22.5rem,85vw)]"
  bandClassName="h-16"         // the top band, the same height as the bar
  hideFrom="(min-width: 840px)"
>
  {(close) => /* the sheet's contents */}
</Sheet>
```

It owns: the trigger button, the dialog, the close button, measuring, the
`(min-width: 840px)` listener, `aria-expanded`/`aria-controls`/
`aria-haspopup="dialog"`, and every ponytail comment that is now
duplicated (keep one copy, in `Sheet`). `MobileNav` and `AccountSheet` become
thin callers. Keep the ids (`public-nav-sheet`, `account-sheet`) and the
accessible names exactly as they are. Tours and tests may key on them.

---

# 3 — The motion

## 3.1 — Timings (add to `DESIGN.md` §9)

| Piece | Enter | Exit |
|---|---|---|
| Sheet | slide from the trailing edge, **300ms `ease-standard`** (unchanged) | slide back, **200ms `ease-standard-accelerate`** |
| Scrim | opacity 0 → 1, 300ms `ease-standard` | 1 → 0, 200ms `ease-standard-accelerate` |
| Trigger → X | 300ms `ease-standard` | 200ms `ease-standard-accelerate` |
| Reduced motion | sheet, scrim and icon **fade only**, 150ms `ease-out` | the same |

Exits are shorter and accelerate. Things leaving should get out of the way,
which is M3's own rule. Add the token next to `--ease-standard`:

```css
/* M3 standard accelerate — for things leaving the screen. */
--ease-standard-accelerate: cubic-bezier(0.3, 0, 1, 1);
```

Replace the existing §9 row "Mobile sheet open" with rows for open, close and
the trigger morph. Neither animation loops, so the "motion nudges once" rule
holds.

## 3.2 — Entry and exit, in CSS

The Tailwind variant chain is already hard to read, and exit needs
`transition-behavior: allow-discrete` on `display` and `overlay`. Move the
choreography into **one commented block in `app/globals.css`** beside
`.th-fade-in`, with `th-` names. Roughly this, and confirm it in a browser,
don't assume:

```css
.th-sheet,
.th-sheet::backdrop {
  transition-property: translate, opacity, display, overlay;
  transition-behavior: allow-discrete;
  transition-duration: 200ms;
  transition-timing-function: var(--ease-standard-accelerate);
}
.th-sheet          { translate: 100% 0; }
.th-sheet::backdrop { opacity: 0; }

.th-sheet[open],
.th-sheet[open]::backdrop {
  transition-duration: 300ms;
  transition-timing-function: var(--ease-standard);
}
.th-sheet[open]          { translate: 0 0; }
.th-sheet[open]::backdrop { opacity: 1; }

@starting-style {
  .th-sheet[open]           { translate: 100% 0; }
  .th-sheet[open]::backdrop { opacity: 0; }
}
```

- Keep `backdrop:bg-obsidian/60` and its ponytail comment. Only the opacity
  animates.
- Remove the old `open:transition-[translate] … starting:open:translate-x-full`
  classes, so the old and new motion don't both apply.
- **Browser support.** `@starting-style` and `allow-discrete` work in current
  Chrome, Edge, Safari and Firefox. Where the `overlay` transition is
  unsupported, the dialog leaves the top layer straight away, so **the exit is
  instant. That is the floor, and it is no worse than today.** Entry must work
  everywhere. Write the browsers you actually checked into the PR.

## 3.3 — The X lives where the trigger was

**Position: measure, don't hard-code.** The public header is 64px and sticky,
except below 480px of height, where it turns `static` and scrolls away. The app
bar is 56px and fixed. Side insets change at 600px. A hard-coded offset would be
wrong in at least one of those cases.

On open, before `showModal()`:

1. Read the trigger's `getBoundingClientRect()`.
2. Compute the X's `top` and `right` with a **pure function in `lib/sheet.ts`**:
   `closeButtonPosition(triggerRect, viewportWidth, sheetWidth)`.
   - Use `document.documentElement.clientWidth` for the viewport, **not**
     `innerWidth`. Windows desktop browsers have a 17px classic scrollbar, and
     the fixed dialog's right edge is the scrollbar's left edge.
   - `right = viewportWidth − rect.right`, `top = rect.top`.
   - **Trigger off-screen** (`rect.bottom <= 0`, the scrolled-away static
     header): fall back to centring the X in the sheet's top band.
   - Clamp so the 48px X stays fully inside the sheet.
3. Set the result as CSS custom properties on the dialog (`--th-x-top`,
   `--th-x-right`) and position the X `absolute` from them.
4. Re-measure on `resize` while open. Remove the listener on close.

Unit-test `closeButtonPosition` (in view, scrolled away, scrollbar present,
clamped).

**The X comes first in the DOM** and gets `autoFocus`, so `showModal()` puts
focus on the spot the person just pressed. A keyboard user sees the focus ring
appear where the trigger was. Esc, the scrim and links still close the sheet,
and focus still returns to the trigger. The platform already does all of that;
don't rebuild it.

**Each sheet's top band matches its bar's height** (`h-16` public, `h-14` app),
so the X is centred in it exactly as the trigger is centred in the bar:

- **Public sheet**: the band holds only the X. The nav list starts below it.
- **Account sheet**: the header row (avatar 40px, display name,
  "Account · builder") **moves into the band**, vertically centred, with right
  padding that clears the X (`pr-16` or whatever the measured X needs). The X
  leaves the row. Long names still truncate.

## 3.4 — The morph

The X button inside the sheet carries **both** glyphs, stacked. Which one shows
is driven by the dialog's `[open]`, so entry, exit, Esc and scrim-close all
animate the same way, with no React state in the loop.

**Hamburger → X (`MobileNav`)**: a true line morph.

- Add `components/ui/MenuMorphIcon.tsx`: one inline SVG drawn with **the
  installed lucide `Menu`'s geometry**, which in `lucide-react` 1.x is
  `M4 5h16`, `M4 12h16`, `M4 19h16` on a 24 grid, stroke 2, round caps. Check
  `node_modules/lucide-react/dist/esm/icons/menu.js` rather than trusting this
  line.
- Use it **as the trigger in the bar too**, in its resting state, so the bar's
  hamburger and the sheet's hamburger frame are pixel-identical. That is what
  makes the hand-off seamless when the sheet finishes closing.
- In `.th-sheet[open]`, with `transform-box: view-box` and
  `transform-origin: 12px 12px`:
  - top bar: `rotate(45deg) translateY(7px)`
  - middle bar: `scaleX(0)`, opacity 0 (gone within the first ~100ms)
  - bottom bar: `rotate(-45deg) translateY(-7px)`
  - (CSS applies these right to left: translate onto the centre line, then
    rotate about the centre.)
- `@starting-style` gives the bars their hamburger geometry, so the morph plays
  on entry. On exit they transition back while the dialog is still drawn.
- **Reduced motion**: no rotation. The three bars fade out and a plain X fades
  in, in place.

**Avatar → X (`AccountSheet`)**: a hand-off, not a morph (a photo can't become
two lines).

- Layer 1: the same `Avatar` at the same 40px as the bar. On open it goes to
  `scale(0.6) rotate(90deg)` and opacity 0.
- Layer 2: lucide `X` at 20px, from `rotate(-90deg)` / opacity 0 to rest.
- Exit plays it in reverse: the X spins out and the avatar spins back in, so at
  the last frame the sheet's avatar sits exactly on top of the bar's avatar.
- **Reduced motion**: crossfade only.

## 3.5 — What must not change

- Sheet widths, the trailing-edge side, `rounded-l-[16px]`, the scrim colour,
  rows, links, Sign out, "Replay page tour" and the theme toggle placement.
- Every accessible name, id and `aria-*` relationship.
- Nothing at ≥840px. The sheets don't render there. Desktop must stay
  pixel-identical.
- `AdminTopNav`'s hamburger and panel. That is a hand-built drop-down, not a
  dialog, and it stays last in the rollout, as in the M3 specs. **Report** how
  far it is from `Sheet`, but don't change it.

---

# 4 — Tests

`npm test`:

- `closeButtonPosition`: trigger in view at 360 and 700px wide; trigger
  scrolled above the viewport (falls back to the band); a 17px scrollbar
  (`clientWidth` < `innerWidth`); clamping.
- `MenuMorphIcon` renders the same three path `d` values as lucide's `Menu`.
  If lucide changes the icon, this test should fail rather than let the
  hand-off drift.

# 5 — Acceptance

- [ ] Both sheets **and their scrims** animate in **and out**: 300ms in,
      200ms out.
- [ ] On close, the sheet's trigger glyph lands on the bar's trigger with no
      visible jump. Record a 0.25× screen capture for the PR.
- [ ] The X is within 1px of the trigger's position at 360, 390, 599, 600 and
      839px wide, in both themes, on `/` (public) and `/dashboard` (app).
- [ ] Public sheet at 844 × 390 (landscape, static header) after scrolling
      down: the X sits centred in the sheet's band, not off-screen.
- [ ] Windows Chrome with a classic scrollbar: the X is not offset by 17px.
- [ ] Esc, scrim tap, the X, and tapping a link all close it with the exit
      motion; focus returns to the trigger.
- [ ] Open a sheet at 800px and widen the window past 840: the sheet closes
      and the page is usable (§1.3).
- [ ] Reduced motion on (Windows: Settings → Accessibility → Visual effects →
      Animation effects off): fades only, no slide, no rotation.
- [ ] VoiceOver/TalkBack: unchanged announcements. The trigger reports
      expanded/collapsed.
- [ ] Desktop 1280 and 1440: pixel-identical to `main`.
- [ ] All four gates.

## Commit sequence

1. `refactor(sheet): extract a shared Sheet from MobileNav and AccountSheet`
   (no visible change)
2. `fix(sheet): close when the viewport reaches 840px`
3. `feat(motion): animate the sheets and scrims in and out`
4. `feat(sheet): place the close button on the trigger's position`
   (+ `lib/sheet.ts` and its tests)
5. `feat(motion): morph the hamburger and avatar into the close button`
   (+ `MenuMorphIcon` and its test)
6. `docs(design): sheet motion rows in DESIGN.md §9`
