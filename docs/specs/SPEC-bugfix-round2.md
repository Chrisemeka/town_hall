# SPEC: Bug Fix Round 2 + Doc Navigation

**Status:** Built — §2 decided **(b)**, §4.3 decided **arrows in**
**Branch:** `fix/terms-copy-summary-docnav-skills`
**Base:** `main`
**Migration:** none
**Risk:** low. §2 (b) loosens what a project summary may contain — three
sentences under 200 characters now save. Nothing else changes what the server
accepts.

## Summary

Two bugs and two small improvements. They don't depend on each other, so each
one is its own commit.

1. The terms gate asks people to agree to the **Guides**. It should name the
   Terms of Service and the Privacy Policy.
2. The project summary label reads "WHAT IS IT? (2 SENTENCES)". The schema
   enforces that rule, so the hint can't just be deleted.
3. Section navigation and a document switcher for `/terms`, `/privacy`,
   `/guides/builder` and `/guides/tester`.
4. The skills dropdown stays open after a pick.

## Non-goals

- The content of any of the four documents. One thing found while reading,
  reported and **not** fixed: tester guide §4 still lists "What actually
  happened" as required on a fail or blocked step. `CLAUDE.md` says
  `actual_result` was dropped from the form for those statuses (except
  `ui_design`). That's for a content pass.
- Search within documents. Scroll-spy (see §3.5).
- A DOM test environment. `vitest` runs `node`. The same rule as round 1
  applies: where a test needs to see UI behaviour, the decision moves into a
  pure function or gets rendered with `renderToStaticMarkup`.

---

## §1 — Terms gate names the wrong document

### 1.1 — Findings

- `app/terms-accept/page.tsx:64`: the subhead says "the Terms of Service and the
  Guides".
- `components/TermsAcceptForm.tsx:84`: **the link beside the checkbox is wrong
  too, and that's the one that matters.** The text reads "I agree to Twnhall's
  Terms of Service and Guides", and the second link goes to `/guides`. Both
  links already open in a new tab (`target="_blank"`).
- Grep across `app/`, `components/`, `emails/`, `lib/` and `actions/`: **no
  other place gives consent** while pointing at the Guides. The signup form has
  no terms line, and the welcome email doesn't mention terms. The footer links
  Guides, Privacy and Terms as navigation. That's fine and stays as it is.

### 1.2 — Fix

- Subhead: "Have a read of the Terms of Service and the Privacy Policy, then
  tick the box below."
- Checkbox: "I agree to Twnhall's Terms of Service and Privacy Policy". The
  second link goes to `/privacy`. Both keep `target="_blank"` and gain
  `rel="noopener"`.

### 1.3 — Tests

- `scripts/guides.test.mts`, alongside the other source assertions. The gate
  form links `/terms` and `/privacy` and never `/guides`, each link opens in a
  new tab, the page subhead names both documents, and
  `app/(public)/terms/page.tsx` and `app/(public)/privacy/page.tsx` exist (so
  neither link can 404).
- `scripts/access.test.mts` is unchanged and still passes. Gate behaviour isn't
  touched.

---

## §2 — "(2 sentences)" and the rule behind it

### 2.1 — Findings

- The label appears **twice**: `CreateProjectForm.tsx:166` and
  `EditProjectForm.tsx:163`.
- The rule lives in `projectSchema` (`countSentences(value) <=
  PROJECT_SUMMARY_MAX_SENTENCES`).
- The **builder guide** states the rule in prose: "capped at
  {PROJECT_SUMMARY_MAX} characters and {PROJECT_SUMMARY_MAX_SENTENCES}
  sentences". It imports the constant.
- `countSentences` has exactly one production caller, the refine above, plus
  `lib/__tests__/sentences.test.ts`.

### 2.2 — Decision: (b)

| | Label | Rule | Consequence |
|---|---|---|---|
| **(a)** recommended | bracket dropped | kept | The helper becomes "Testers read this on the Explore feed — say what it does and who it's for. Two sentences is plenty." in both forms. The guide stays true. |
| (b) | bracket dropped | removed | Delete the refine, `PROJECT_SUMMARY_MAX_SENTENCES`, `lib/sentences.ts` and its test, which would have no caller left. The guide sentence would become false, so it has to change to name only the character cap. That touches guide content, which this round otherwise keeps out of scope. |
| (c) | bracket dropped | kept, unstated | Silent rejection. Not recommended. |

The character counter, the placeholder and `PROJECT_SUMMARY_MAX` are untouched
under every option.

### 2.3 — Tests (the record of the decision)

**Chosen: (b).** `lib/validation/__tests__/projectSummary.test.ts`: a
three-sentence summary under 200 characters **parses**; one over 200 is still
rejected. Neither form label contains "(2 sentences)". `lib/sentences.ts` and
its test are deleted — the refine was their only caller. The builder guide now
names only the character cap. `lib/setup.ts` still suggests "two sentences on
what it does" in the setup completion copy; that is advice, not a rule, and is
left alone.

---

## §3 — Doc navigation

### 3.1 — Sections as data

New file `lib/docNav.ts`. It's pure, with no React import, so the `node` tests
can import it:

```ts
export const DOCS = [
  { slug: "terms",   href: "/terms",          label: "Terms of Service", numbered: true,
    sections: [{ id: "user-agreement", title: "User Agreement" }, …] },
  { slug: "privacy", href: "/privacy",        label: "Privacy Policy",   numbered: false, sections: […] },
  { slug: "builder", href: "/guides/builder", label: "Builder guide",    numbered: true,  sections: […] },
  { slug: "tester",  href: "/guides/tester",  label: "Tester guide",     numbered: true,  sections: […] },
] as const
export function docSection(slug, id): { id, number?, title }
```

Each page's headings render from that data. `<Section number="3"
title="Missions and Review">` becomes `<Section {...docSection("terms",
"missions-and-review")}>`. The title and number come from the data, and so does
the anchor the nav links to. The id is typed from the `as const` data, so an id
that doesn't exist fails `tsc`. Numbers come from position in the list, which
matches today's hand numbering exactly (terms 1–12, builder 1–8, tester 1–7;
privacy has none).

Ids are kebab-case slugs of today's titles, written into the data rather than
derived at runtime. If a heading is renamed later, its id stays put, so shared
links keep working.

**Restructuring estimate:** mechanical. Each of the four pages changes one prop
line per section, which is 37 sections in total. The local `Section` in terms
and privacy, and the one in `components/public/prose.tsx`, each gain an `id` on
the heading plus `tabIndex={-1}` and `scroll-mt-24` (the public header is a
sticky `h-16`). Each page keeps its own typography. No DOM-derived fallback is
needed.

### 3.2 — `<DocNav>` / `<DocLayout>`

New file `components/public/DocNav.tsx`. All four pages use it. It wraps the
page's existing `max-w-[720px]` column:

- **≥ lg:** two columns. A sticky sidebar (`lg:sticky lg:top-24`) holds "On this
  page" (the current doc's sections) and "Documents" (all four, with the current
  one marked `aria-current="page"`).
- **< lg, down to 360px:** a native `<details>` at the top with no `open`
  attribute, so it's **collapsed by default** without JavaScript. The summary
  reads "On this page". Inside are the same two lists. The sidebar is hidden.
- Semantic tokens only: `ink`, `ink-muted`, `line`, `accent-ink`,
  `surface-raised`. No hex.

### 3.3 — Focus and motion

A section link is a real `<a href="#id">`, so it still works without
JavaScript, opened in a new tab, or copied. Its click handler does this:
`preventDefault`, then `scrollIntoView({ behavior: prefersReducedMotion() ?
"auto" : "smooth" })`, then `focus({ preventScroll: true })` on the heading
(`tabIndex={-1}` makes a heading focusable), then `history.replaceState` to
update the hash. **`prefersReducedMotion()` is reused from `lib/focus.ts`.** It
doesn't get a second copy. The jump logic is one exported function,
`jumpToSection(id)`, so it can be tested with a stubbed `document`.

### 3.4 — Scroll-spy

**Not included.** Navigation ships first, as the prompt asks. The current doc
is marked in the switcher, and that's enough until someone asks for more.

### 3.5 — Tests

- `components/public/__tests__/docNav.test.ts` (vitest):
  - **Drift:** for every doc in `DOCS`, the page source calls `docSection("<slug>",
    "<id>")` exactly once for each section. Every `docSection(...)` call in the
    page names a section in the data, and no heading in the page bypasses it
    (no `title="` left on a `Section`). This is asserted by looping over the
    data, not by hand.
  - Every doc `href` maps to an existing `page.tsx`.
  - The rendered `DocNav` (via `renderToStaticMarkup`) links all four hrefs and
    every `#id` of the current doc. Its `<details>` has no `open` attribute
    (collapsed by default at 360px), and the current doc carries
    `aria-current="page"`.
  - `jumpToSection` focuses the heading with `preventScroll: true`, and scrolls
    with `"auto"` when reduced motion is set and `"smooth"` otherwise.
- Both themes: `scripts/tokens.test.mts` already fails on any palette hex. The
  rest is the manual phone-viewport pass.

---

## §4 — Skills dropdown closes on pick

### 4.1 — Findings

- On a successful add, `add()` clears the input but leaves `open` true, so the
  full suggestion list reappears under the cursor. That's the reported bug.
- **A sibling bug:** after Escape, typing never reopens the list. `onChange`
  doesn't touch `open`, so it stays closed until the input is blurred and
  focused again.
- **The prompt's "keyboard contract — arrows move" describes behaviour that
  doesn't exist.** `SkillsInput` has no arrow handling and no
  `aria-activedescendant`. Enter adds whatever text is in the input. So a
  keyboard user can't pick a suggestion today: typing "front" and pressing Enter
  adds a custom skill called "front", not "Frontend". See decision 4.3.
- Focus already stays in the input after a pick. The option's `onMouseDown`
  calls `preventDefault`, and Enter fires from the input itself. Nothing needs
  adding there.
- `aria-expanded={open && suggestions.length > 0}` already tracks the rendered
  list. It stays derived from the same state.
- The maximum (`SKILLS_MAX`) is enforced in `addSkill`, and the minimum in the
  verification and settings schemas. Neither is touched.

### 4.2 — Fix

The combo box state (`input`, `open`, `active`) moves into a pure reducer,
`skillsCombo(state, event)` in `lib/skills.ts`. `SkillsInput` uses it with
`useReducer`. The events are `type`, `focus`, `blur`, `escape`, `added`, and
`arrow` if 4.3 says yes.

- `added` → input cleared, `open: false`.
- `type` → `open: true`. Typing after a pick or after Escape reopens the list.
- `escape` → `open: false`, nothing added.
- Custom skills go through the same `add(raw)` path as before, so
  `canonicalSkill()` / `normalizeSkills()` are unchanged.

### 4.3 — Decision: arrow keys added

**Recommended: add them.** ArrowDown/ArrowUp move an active option, tracked as
`aria-activedescendant` with ids on the options. Enter adds the active option
if there is one, otherwise the typed text, so custom skills still work.
Escape clears the active option and closes. That's about 20 lines and makes the
prompt's "three skills without touching the mouse" work for vocabulary skills.
If you say no, Enter-on-typed-text stays the only keyboard path.

### 4.4 — Tests

`lib/__tests__/skillsCombo.test.ts`:

- `added` closes the list. The input stays the focused control: `focus` is
  never dispatched and no handler calls `blur`.
- `type` after `added` reopens the list. `type` after `escape` reopens it too.
- `escape` closes without changing the skill list.
- A custom skill (`addSkill([], "Rust embedded")`) is still added.
- `isExpanded(state, suggestions)` (the value `aria-expanded` renders) is true
  only when the list is open and has suggestions, and false again after `added`
  and after `escape`.
- If arrows are in: ArrowDown wraps, and Enter with an active option adds that
  option, not the typed text.

---

## Documentation

- `CLAUDE.md`: a short **Doc navigation** paragraph. `lib/docNav.ts` is the
  single source for section headings, anchors and the nav, and `docNav.test.ts`
  fails on drift. Also a line in the auth/setup section: the terms gate names
  the Terms of Service and the Privacy Policy, never the Guides.
- `TownHall_Checklist (1).xlsx`: QA rows for the terms gate links, the summary
  rule (as decided), doc navigation at 360px, and the skills dropdown closing.

## Commits

1. `Name Terms and Privacy on the terms gate`
2. `Move the two-sentence hint off the summary label` (or `Drop the sentence rule`)
3. `Add section navigation to the four long documents`
4. `Close the skills list on pick and reopen on typing`
5. `Document doc navigation and the terms gate`

## Gates

`npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`,
`npm test`. Then a manual pass on a phone viewport, in both themes, covering
the four checks in the prompt.
