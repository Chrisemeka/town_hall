# SPEC: Tabbed Settings

**Status:** Building
**Branch:** `feat/settings-tabs`
**Base:** `feat/settings-sections`
**Migration:** none
**Risk:** low, with one trap — §4

## Summary

`/settings` becomes four tabs instead of one long scroll. **No content
changes**: nothing is rewritten, dropped, reworded or reordered within a
section. Only where each section sits.

## Non-goals

- **Any copy edit, metric change or reordering.** If something looks wrong,
  it gets flagged in the PR, not fixed here. §7 lists what turned up.
- **A modal on tab switch.** §4.
- **Touching what each section does.** `GiveAndTake` and `PlanSection` move
  unaltered.

## §1 — The four tabs

Default **Profile**.

| Tab | Holds |
|---|---|
| **Profile** | the existing form — display name, country, phone, timezone, bio, skills, locked email, Save Profile — plus the Appearance theme toggle |
| **Account** | Linked Accounts, the tester-account switch, Danger Zone |
| **Activity** | Give and take, unchanged |
| **Plan** | the tier comparison and Get in touch, unchanged |

**Appearance moves into Profile** rather than keeping a tab: it is a personal
preference and does not carry one on its own.

**"Export your data" is not in the Account tab yet, because it does not
exist.** It is `feat/feedback-export`, PR 3 of Stage 3, and it lands in this
tab when it ships — the pairing with Delete is the right one and the tab is
built expecting it. Adding a placeholder for it now would be inventing content
this PR is told not to add.

### 1.1 — Splitting `SettingsForm`

Profile and Account currently live in one component, and they now go to
different tabs. They share no state: the profile half uses `values`, `errors`,
`saved`; the account half uses `deleteStep`, `deleting`, `deleteError`. So the
Account, tester-switch and Danger Zone markup moves to
`components/settings/AccountPanel.tsx` **verbatim** — same elements, same
classes, same copy — and `SettingsForm` keeps the profile form.

That is a file move, not a content change.

## §2 — Linkable, and Back walks the tabs

`/settings?tab=plan` opens on Plan. Refresh keeps you there. Another surface
can deep-link — an upgrade prompt elsewhere should be able to point straight
at Plan.

**A user-initiated tab click uses `push`, not `replace`**, so Back moves
between tabs. Stated because it is a decision rather than an accident: once
the URL visibly changes, Back not undoing it is the surprise. The cost is
history entries; the alternative costs a Back button that skips the whole
Settings visit, which is worse.

**Arrow keys move focus without activating** — manual activation, which
WAI-ARIA permits. Automatic activation is usually preferable, but combined
with `push` it would stack a history entry per keypress: arrowing Profile →
Plan would leave three entries for tabs the person only passed over. Enter,
Space or a click activates, and that is what pushes.

An unknown or absent `?tab=` resolves to Profile rather than erroring.

## §3 — Real tabs

`role="tablist"` / `role="tab"` / `role="tabpanel"`, with `aria-selected`,
`aria-controls` and `aria-labelledby` wired both ways.

- **Roving tabindex.** Only one tab is in the tab order. It follows the
  *focused* tab while the strip has focus and returns to the *active* tab when
  focus leaves — which is what manual activation requires, or arrowing to a
  tab and pressing Tab would jump somewhere unexpected.
- **Left/Right** move focus, wrapping at both ends. **Home/End** jump to the
  ends.
- Inactive panels carry `hidden`, which takes them out of the accessibility
  tree and the tab order without unmounting them (§4).
- The existing `focus-visible` ring standard applies to every tab.

## §4 — The unsaved-changes trap

Profile is a form. Someone edits their bio, clicks Plan, and the edit is gone.

**`useUnsavedChangesWarning` does not catch this.** It hooks `beforeunload`,
which does not fire on an in-page tab switch. The hook stays — it still covers
closing the tab — but it is not the answer here.

**The answer is that the Profile form never unmounts.** All four panels mount
at once; switching toggles `hidden`. React keeps the state of a component that
stays mounted, so switching back restores exactly what was typed, including
scroll position within the field and any validation errors already on screen.

**A quiet indicator on the Profile tab label** so the state is not invisible:
a small dot when the form is dirty, with the word "unsaved" for screen
readers, since a dot alone is colour conveying state. `SettingsForm` already
computes dirtiness for the `beforeunload` hook; it reports the same boolean
upward rather than a second definition being invented.

**No modal.** Blocking the switch is more annoying than the problem it
prevents, and the problem is already prevented by not unmounting.

## §5 — Mobile

**Horizontal scroll, with the active tab scrolled into view.** Not a
`<select>`.

Four tabs do not fit 360px. Of the two options:

- A `<select>` stops being a tablist. It would need different ARIA, a
  different keyboard contract, and the brief asks for real tabs — having one
  pattern on desktop and another below a breakpoint doubles what has to be
  correct.
- Scrolling keeps all four discoverable: a select hides the options until
  opened, and "Plan" existing at all is something a user should be able to see.

They must not wrap into a ragged two-row grid, so the strip is
`flex-nowrap overflow-x-auto` with the scrollbar hidden and the active tab
scrolled into view on change.

## §6 — Tests

The tab model — which tab a query string resolves to, and where an arrow key
moves — is pure and goes in `lib/settingsTabs.ts` with a Vitest file. The same
constraint as every UI PR before this one applies: `vitest.config.mts` is
`environment: "node"` with no Testing Library, so the *rendering* of the strip
is not covered and the manual plan carries it.

| Assertion | Why |
|---|---|
| `?tab=plan` → Plan | the deep link |
| absent, unknown, wrong case → Profile | a bad URL opens the page, not an error |
| Left from the first wraps to the last, Right from the last wraps to the first | the APG contract |
| Home → first, End → last | the same |
| every tab has a non-empty label and a unique id | the strip cannot render a blank tab |

## §7 — Flagged, not fixed

Found while moving the markup. **Not touched in this PR**, per the brief:

- **The "Manage" button beside Linked Accounts does nothing.** No handler, no
  href — it renders and cannot be pressed to any effect. Whether that section
  should exist at all is a product question.
- **The Danger Zone uses inline `rgba(255,79,79,…)` literals** for its tinted
  background and borders. They survived the theme audit because
  `tokens.test.mts` matches hex, not `rgba()`. They are Ember at low alpha, so
  they read acceptably on both grounds, but they are the same class of thing
  the audit exists to catch.

## Acceptance criteria

1. Four tabs, Profile default, content identical to before.
2. `/settings?tab=plan` opens on Plan; an unknown value opens Profile.
3. A tab click pushes, so Back returns to the previous tab.
4. Arrows move focus, Home/End jump, Enter/Space activates; only one tab is in
   the tab order at a time.
5. `role`, `aria-selected`, `aria-controls`, `aria-labelledby` all correct;
   inactive panels `hidden`.
6. Typing in the bio, switching tabs and coming back leaves the text there.
7. The Profile tab shows an unsaved indicator when the form is dirty, with a
   text equivalent.
8. At 360px the strip scrolls horizontally and never wraps.
9. Both themes.
10. Four gates.

## Manual test plan

What no test here covers:

- Click every tab, both themes, desktop and 360px.
- Tab into the strip, arrow through it, Home/End, Enter to activate.
- Type in the bio, switch to Plan, switch back — text still there, dot on the
  Profile tab while dirty.
- Open `/settings?tab=plan` directly.
- Press Back after switching tabs.

## Commit sequence

1. `feat(settings): add the tab model`
2. `refactor(settings): split the account sections out of the profile form`
3. `feat(settings): make settings tabbed`
4. `test(settings): cover the tab model`
