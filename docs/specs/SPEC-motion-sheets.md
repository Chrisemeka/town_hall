# SPEC: Motion Pass 1 — The Two Sheets

**Status:** Implemented 2026-10-17. Deviations from this draft: the account
band is `pr-20 medium:pr-24` (a 16/24px gap beside the X, not flush), and the
dialog is callback-ref state rather than a ref, because `close` is handed to
children during render and `react-hooks/refs` refuses that
**Branch:** `feat/motion-sheets`
**Base:** `main`
**Source:** `docs/TWNHALL_MOTION_SHEETS_PROMPT.md`
**Migration:** none
**New dependencies:** none. No Framer Motion: both sheets are native
`<dialog>`s, and CSS handles entry and exit.
**Risk:** low. The change is client-only and limited to below 840px. Ids,
accessible names and the platform's focus handling stay as they are.

## Summary

The public `MobileNav` and the app's `AccountSheet` become thin callers of a
shared `components/ui/Sheet.tsx`. That component:

- animates the sheet **and its scrim**, in (300ms `ease-standard`) and out
  (200ms `ease-standard-accelerate`);
- puts the close button exactly where the trigger is, measured rather than
  hard-coded;
- morphs the trigger into the X: the hamburger's lines become an X, and the
  avatar hands off to an X;
- closes itself when the viewport reaches 840px.

## §1 — Findings confirmed in the code

| Prompt claim | Confirmed | Where |
|---|---|---|
| Scrim has no transition | Yes | `SHEET` in both files: `backdrop:bg-obsidian/60`, with no `transition` on `::backdrop` |
| Close is instant | Yes | `open:transition-[translate]`: once `[open]` is gone, nothing transitions and `display` flips to `none` |
| Reduced motion gets nothing | Yes | `motion-safe:starting:open:translate-x-full` is the only motion |
| X is ~8px low on public | Yes | The bar is `h-16` with a centred 48px button (top 8). The sheet has `p-4` plus a 48px button (top 16) |
| Horizontal inset differs from 600px | Yes | Bar is `medium:px-6` (24). Sheet is `p-4` (16) |
| Invisible modal at ≥840 | Yes | Both are under `expanded:hidden`: the `MobileNav` wrapper div, and `TopNav`'s mobile actions div |
| Duplicated `SHEET` / `ICON_BUTTON` / wiring | Yes | Near-identical. The only differences are the width (`22.5rem` vs `20rem`) and the button radius (`8px` vs `full`) |
| lucide `Menu` geometry | Yes | `lucide-react@1.0.1` `menu.js`: `M4 5h16`, `M4 12h16`, `M4 19h16` |

## §2 — `components/ui/Sheet.tsx`

```tsx
type SheetTrigger =
  | { kind: "menu" }
  | { kind: "avatar"; node: React.ReactNode; title?: string }

<Sheet
  id="public-nav-sheet"
  label="Site menu"
  openLabel="Open menu"
  closeLabel="Close menu"
  trigger={{ kind: "menu" }}
  width="w-[min(22.5rem,85vw)]"
  bandClassName="h-16"
  band={/* optional: content centred in the top band, beside the X */}
>
  {(close) => /* everything below the band */}
</Sheet>
```

- **`hideFrom` is not a prop.** Both callers would pass the same
  `(min-width: 840px)`, which is the `expanded:` breakpoint. It is a constant
  inside `Sheet`, and so is the `expanded:hidden` wrapper.
- **`band`** is how the account header gets into the top band (§4.3). The
  public sheet passes nothing.
- **`trigger.kind`** chooses the button shape (`rounded-[8px]` for the menu,
  `rounded-full` for the avatar) and which glyph pair the X carries (§5).

What `Sheet` owns:

- the trigger button: `aria-label={openLabel}`, `aria-haspopup="dialog"`,
  `aria-expanded`, `aria-controls={id}`;
- the dialog: `aria-label={label}`, the scrim-click close, and `onClose`;
- the close button: first in the DOM, `autoFocus`, `aria-label={closeLabel}`;
- measuring the trigger, plus the `resize` listener while the sheet is open;
- the `matchMedia("(min-width: 840px)")` listener that closes the sheet;
- the one surviving copy of each ponytail comment (native dialog, literal
  Obsidian scrim).

`MobileNav` adds `aria-haspopup="dialog"` to its trigger, which it lacked and
`AccountSheet` already had. That is the only change to anything `aria-*`.

**Ids and names are kept exactly.**

| | id | dialog | trigger | close |
|---|---|---|---|---|
| Public | `public-nav-sheet` | Site menu | Open menu | Close menu |
| App | `account-sheet` | Account | Account menu | Close account menu |

## §3 — Entry and exit

### 3.1 Token

`app/globals.css`, beside `--ease-standard`:

```css
/* M3 standard accelerate — for things leaving the screen. */
--ease-standard-accelerate: cubic-bezier(0.3, 0, 1, 1);
```

### 3.2 One block in `globals.css`, beside `.th-fade-in`

This is the shape from prompt §3.2: `.th-sheet` and `.th-sheet::backdrop`
transition `translate, opacity, display, overlay` with
`allow-discrete`. The closed state is 200ms accelerate, `[open]` is 300ms
standard, and `@starting-style` sets the entry frame. Two additions:

- **Reduced motion** (`@media (prefers-reduced-motion: reduce)`): `translate`
  stays at `0 0` in every state, so the sheet doesn't slide. The sheet's own
  `opacity` runs 0 → 1, and every duration becomes 150ms `ease-out`. That gives
  a fade instead of nothing.
- The old `open:transition-[translate] open:duration-300 open:ease-standard
  motion-safe:starting:open:translate-x-full` classes are removed. The
  dialog's class string keeps only layout and `backdrop:bg-obsidian/60`, with
  its ponytail comment.

**Floor:** where `overlay` can't be transitioned, the dialog leaves the top
layer at once and the exit is instant. That is today's behaviour, so nothing
regresses. Entry needs only `@starting-style`. I'll check this in Chrome and
Edge on this Windows machine and record the result in the PR. I can't check
Safari or Firefox from here, and the PR will say so.

## §4 — The X lives where the trigger was

### 4.1 `lib/sheet.ts`, pure

```ts
closeButtonPosition(
  trigger: { top: number; right: number; bottom: number },
  viewportWidth: number,   // document.documentElement.clientWidth
  sheetWidth: number,
  bandHeight: number,
): { top: number; right: number }
```

- `right = viewportWidth − trigger.right`, `top = trigger.top`.
- **Off-screen** (`trigger.bottom <= 0`): `top = (bandHeight − 48) / 2`. The
  measured `right` still holds, because the horizontal inset doesn't change
  when the header scrolls away.
- **Clamp**: `right` to `[0, sheetWidth − 48]`, `top` to `≥ 0`, so the
  48px X stays fully inside the sheet.

**One addition to the prompt's signature: `bandHeight`.** The fallback needs
to know how tall the band is, and the function stays pure only if that is
passed in. `Sheet` reads it from the band element's `offsetHeight`.

### 4.2 Measuring order

When the trigger is clicked:

1. Read `trigger.getBoundingClientRect()` and `clientWidth`.
2. Call `showModal()`.
3. Read `dialog.offsetWidth` and `band.offsetHeight`, then write
   `--th-x-top` / `--th-x-right` onto the dialog.

**This deviates from the prompt**, which says to compute before
`showModal()`. Before it, the dialog is `display: none` and has width 0, so
the sheet width can't be measured yet. Steps 2 and 3 run in the same task, so
the browser doesn't paint between them, and `offsetWidth` ignores `translate`.
The X is never seen in the wrong place.

While the sheet is open, a `resize` listener repeats steps 1 and 3. The
dialog's `close` event removes the listener.

The X is `absolute` at `top: var(--th-x-top); right: var(--th-x-right)`.

### 4.3 Bands

- **Public:** `h-16`, holding only the X. The nav list starts below it.
- **App:** `h-14`. The header row (40px avatar, name, "Account · builder")
  moves into the band, vertically centred, with `pl-6 pr-16`. `pr-16` is 64px,
  which clears the 48px X at its measured 16px inset (`px-4` in `TopNav`
  below 600px). From 600px the inset is 24px, so the row needs `medium:pr-18`
  (72px). `truncate` keeps long names on one line.
- The rest of each sheet keeps its current padding and dividers. Rows, Sign
  out, "Replay page tour" and the theme toggle are unchanged.

## §5 — The morph

The X button carries both glyphs, stacked. Which one shows depends on whether
`.th-sheet` has `[open]`, which is pure CSS with no React state. That means
Esc, scrim, link and X all close the sheet with the same motion.

### 5.1 `components/ui/MenuMorphIcon.tsx`

This is an inline 24-grid SVG: three `<path>`s with lucide `Menu`'s exact `d`
values, `stroke="currentColor"`, stroke width 2, round caps and joins, and
classes `th-bar-top` / `th-bar-mid` / `th-bar-bot`. It renders at 20px, the
same size as today's `<Menu size={20}>`.

**The bar's trigger uses it too, at rest.** So the bar's hamburger and the
sheet's resting frame are the same markup.

In `.th-sheet[open]`, using `transform-box: view-box` and
`transform-origin: 12px 12px`:

| Bar | Transform | Opacity |
|---|---|---|
| top | `rotate(45deg) translateY(7px)` | 1 |
| mid | `scaleX(0)` | 0, 100ms |
| bottom | `rotate(-45deg) translateY(-7px)` | 1 |

`@starting-style` returns the bars to the hamburger, so the morph plays on
entry. On exit the bars transition back while the dialog is still drawn
(that's what the `overlay` transition buys).

**Reduced motion:** the bars don't rotate. They fade out, and a lucide `X`
stacked in the same box fades in. The `X` is present in the markup for both
modes and hidden by opacity when motion is allowed.

### 5.2 Avatar → X

- Layer 1 is the same `<Avatar size={40}>` as the bar. Open state:
  `scale(0.6) rotate(90deg)`, opacity 0.
- Layer 2 is lucide `X` at 20px. Closed state: `rotate(-90deg)`, opacity 0.
  Open state: at rest.
- Exit reverses this, and on the last frame the sheet's avatar sits exactly
  over the bar's.
- **Reduced motion:** crossfade only.

All of this goes in the same `globals.css` block, with `th-` class names.

## §6 — Close at 840px

`Sheet` subscribes to `matchMedia("(min-width: 840px)")` on mount. On
`change` with `matches`, it calls `dialog.close()`, which does nothing if the
sheet is already closed. `close` fires and `aria-expanded` resets. This runs
in the refactor's second commit, before any motion.

## §7 — What doesn't change

- Sheet widths (`22.5rem` / `20rem`), trailing edge, `rounded-l-[16px]`, the
  scrim colour, and every row and link.
- The ids, names and `aria-*` relationships listed in §2.
- **≥840px.** Both sheets sit inside `expanded:hidden`. `PublicHeader` and
  `TopNav` markup above that breakpoint is untouched.
- `AdminTopNav`. See §9.

## §8 — Tests

**`lib/__tests__/sheet.test.ts`** (vitest) covers `closeButtonPosition`:

- trigger in view at 360px wide (`px-4`) and at 700px wide (`px-6`);
- trigger scrolled above the viewport, which falls back to the band centre;
- a 17px scrollbar, where `clientWidth` is 17 less than `innerWidth` and
  `right` comes out the same as with no scrollbar;
- clamping, both `right` beyond `sheetWidth − 48` and a negative `top`.

**`components/ui/__tests__/menuMorphIcon.test.ts`** renders `MenuMorphIcon`
and lucide's `Menu` with `renderToStaticMarkup` and asserts the same three
`d` values in the same order. If lucide changes the icon, this fails.

**`scripts/mobile.test.mts`:**

- `Sheet.tsx` and `MenuMorphIcon.tsx` join `REVAMPED`.
- The literal-Obsidian scrim assertion moves from `MobileNav.tsx` to
  `Sheet.tsx`, where the class now lives.

## §9 — `AdminTopNav`: report only

Here is how far it is from `Sheet`. I'm not changing it.

- It's a drop-down below a 56px bar, not a trailing-edge sheet. It's
  conditionally rendered (`{mobileOpen && …}`), not a `<dialog>`. There is no
  focus trap, no Esc, and focus isn't returned.
- It uses Tailwind's `md:` (768), not the M3 `expanded:` (840). It isn't in
  the revamp yet.
- Rows are `h-10` (40px), below the 48px target. The scrim is `bg-black/50`,
  not `bg-obsidian/60`.
- It already swaps `Menu`/`X` in place, so trigger and close share a spot.
  That is the effect this pass builds, done there by re-rendering one button.

Moving it onto `Sheet` means a trigger kind of `menu`, the nav links and Sign
out as children, and dropping the scrim and state it builds itself. That's
roughly a 60-line deletion, once its page's revamp turn comes.

## §10 — Design.md §9

The row "Mobile sheet open" is replaced by:

| Interaction | Animation | Duration | Easing |
|---|---|---|---|
| Mobile sheet open | Slide from trailing edge + scrim fade in | 300ms | `ease-standard` |
| Mobile sheet close | Slide to trailing edge + scrim fade out | 200ms | `ease-standard-accelerate` |
| Sheet trigger → close | Hamburger lines morph to X / avatar hands off to X, in place; reversed on close | 300ms in, 200ms out | as the sheet |
| Sheet, reduced motion | Sheet, scrim and icon fade only | 150ms | `ease-out` |

## §11 — Commits

1. `refactor(sheet): extract a shared Sheet from MobileNav and AccountSheet`
2. `fix(sheet): close when the viewport reaches 840px`
3. `feat(motion): animate the sheets and scrims in and out`
4. `feat(sheet): place the close button on the trigger's position`
5. `feat(motion): morph the hamburger and avatar into the close button`
6. `docs(design): sheet motion rows in DESIGN.md §9`

## §12 — Acceptance

These are the prompt's §5 checks, verbatim. The ones I can't run from this
machine (VoiceOver/TalkBack, Safari, a 0.25× screen capture) are marked as
such in the PR, not ticked.
