# Twnhall — Design Brief
**Version:** 2.1  
**Product:** Twnhall — Peer Usability Testing Platform for Developers  
**Audience:** Developers & Engineers (dual role: submitters + testers)  
**Stage:** Early-Stage Startup  
**Scope:** Landing Page + Product Dashboard  

---

## 1. Product Overview

### What is Twnhall?
Twnhall is a peer-driven usability testing platform where developers upload their projects to be tested by other developers in the community. Every user is both a builder and a tester — you submit your project for feedback, and you give feedback on others'. It is collaborative, community-first, and built entirely around the developer-to-developer feedback loop.

### How It Works (Core Flow)

**As a Submitter:**
1. Create a project — fill in Project Name, Project URL, and a Brief Summary.
2. Create Missions under that project — each mission defines one specific area to test (Mission Title + What to Test).
3. Wait for community testers to pick up your missions and submit written feedback.

**As a Tester:**
1. Browse available projects and their missions from the community feed.
2. Pick a mission, visit the project URL, follow the instructions.
3. Submit written feedback + a screenshot as proof of visit, directly tied to that mission.

**The Social Contract:**
The platform is purely community-driven — no points, no rewards. The implicit incentive is reciprocity: you test others so others will test you. To maintain trust and quality, every feedback submission requires both written feedback and a screenshot from the project — the screenshot acts as proof of visit and provides visual context for the submitter. This is the core value proposition and must be communicated clearly throughout the design.

### The One Thing Users Will Remember
**"Ship with confidence. Test each other."** Twnhall feels like a developer community, not a SaaS tool — it carries the energy of a shared workspace where peers hold each other accountable.

---

## 2. Design Principles

1. **Community over software** — The platform exists because of its users. Design should surface people and projects, not abstract metrics.
2. **Dual-role clarity** — Every screen must make it obvious whether the user is acting as a submitter or a tester. The two contexts should never bleed confusingly into each other.
3. **Friction where it matters** — Submitting a project should feel deliberate and structured. Testing a mission should feel lightweight and fast. Forms must reflect this asymmetry.
4. **Precision over decoration** — Every element earns its place. If it doesn't serve the user, it doesn't exist.
5. **Trust through consistency** — The 4-pixel grid, consistent type scale, and uniform component behavior create a product that feels reliable — which matters when the product is built on peer trust.

---

## 3. User Flows

### Flow A — Submitting a Project

```
Sign Up / Log In
      │
      ▼
Dashboard → My Projects tab
      │
      ▼
"New Project" → Project Form
  ├── Project Name        [text input]
  ├── Project URL         [url input]
  └── Brief Summary       [textarea, max 300 chars]
      │
      ▼
Project Created → Project Detail Page
      │
      ▼
"Add Mission" → Mission Form
  ├── Mission Title       [text input]
  └── What to Test        [textarea, open-ended instructions]
      │
      ▼
Mission Published → Visible in Community Feed
      │
      ▼
Testers submit feedback → Submitter reviews under "Feedback Received"
```

### Flow B — Testing a Mission

```
Sign Up / Log In
      │
      ▼
Dashboard → Explore tab (Community Feed)
      │
      ▼
Browse Projects & Missions → Select a Mission
      │
      ▼
Mission Detail Page
  ├── Project name, URL, brief summary
  ├── Mission title
  └── "What to Test" instructions
      │
      ▼
"Open Project in New Tab" → User tests project externally
      │
      ▼
Returns to Twnhall → Feedback form unlocks
      │
      ▼
Submit Written Feedback + Screenshot → Logged to submitter's dashboard
```

---

## 4. Visual Identity

### 4.1 Color System

Twnhall uses a **neutrals-first dark palette with a single bold accent**, following the 60-30-10 rule:
- **60%** — Deep neutral backgrounds (Obsidian, Graphite)
- **30%** — Surface tones, borders, secondary text (Iron, Ash)
- **10%** — Voltage accent, used exclusively on the most important action per screen

| Role | Name | Hex | HSB | Usage |
|------|------|-----|-----|-------|
| **Background (Dark)** | Obsidian | `#0E0E10` | 240°, 6%, 6% | Dashboard base, dark landing sections |
| **Surface** | Graphite | `#1A1A1F` | 240°, 13%, 12% | Cards, panels, sidebar |
| **Border** | Iron | `#2C2C35` | 240°, 20%, 21% | Dividers, input borders, outlines |
| **Text Primary** | Chalk | `#F0F0F2` | 240°, 1%, 95% | Headlines, body text |
| **Text Secondary** | Ash | `#8A8A99` | 240°, 11%, 60% | Labels, metadata, placeholders |
| **Background (Light)** | Bone | `#F5F5F7` | 240°, 2%, 97% | Landing page base |
| **Surface (Light)** | White | `#FFFFFF` | — | Landing page cards |
| **Text (Light mode)** | Midnight | `#0E0E10` | 240°, 6%, 6% | Landing page body text |
| **Accent** | Voltage | `#E8FF47` | 68°, 72%, 100% | Primary CTAs, active states, key highlights |
| **Accent Hover** | Voltage Dark | `#C8E000` | 68°, 100%, 88% | Hover state on Voltage elements |
| **Success** | Mint | `#3FFFA2` | 152°, 75%, 100% | Feedback submitted, mission complete |
| **Destructive** | Ember | `#FF4F4F` | 0°, 69%, 100% | Delete actions, error states |
| **Info** | Sky | `#47B8FF` | 204°, 72%, 100% | Project URLs, neutral info states |

> **Color rationale:** Voltage (`#E8FF47`) is a high-brightness, high-saturation yellow-green in the HSB model. It is connotative (electric, sharp, fast — values developers associate with good tooling), relational (strong contrast against cool-gray neutrals without the cliché of blue-on-dark), and contextual (signals "active/live" in the same way green terminal output or a passing CI badge does). The overall palette stays deliberately cool and neutral — appropriate for a peer trust platform where warmth would feel misplaced.

**Palette tools:**
- Generate Voltage tint/shade scale → [UI Colors](https://uicolors.app) — input `#E8FF47`
- Explore harmony variations → [Adobe Color](https://color.adobe.com) — Split-Complementary from Voltage
- Full palette preview → [Coolors](https://coolors.co) — lock `#E8FF47` + `#0E0E10`
- Contrast verification → [WebAim Contrast Checker](https://webaim.org/resources/contrastchecker/)

> Chalk (`#F0F0F2`) on Obsidian (`#0E0E10`) ≈ **16.9:1** — exceeds WCAG AAA.  
> Ash (`#8A8A99`) on Obsidian ≈ **5.7:1** — meets WCAG AA.  
> Voltage (`#E8FF47`) on Obsidian ≈ **17.3:1** — exceeds WCAG AAA.  
> Verify all new color pairings at WebAim before use.

*(Those three figures previously read 14.5:1, 5.2:1 and 13.5:1. Recomputed by the
WCAG relative-luminance formula they are the values above — the old ones were
conservative, so nothing shipped was failing, but they were wrong.)*

#### One token set, every surface

**Every surface follows the theme.** The literals in the table above still
exist — the semantic layer is built out of them, and a *fill* uses them — but
nothing is a surface, text, border or ring except through a semantic token.
`data-theme` is set once, on `<html>`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `surface` | `#E8E8EE` | Obsidian `#0E0E10` | page ground |
| `surface-raised` | `#F5F5F9` | Graphite `#1A1A1F` | cards, panels |
| `ink` | Obsidian `#0E0E10` | Chalk `#F0F0F2` | headings, body copy |
| `ink-muted` | `#5A5A66` | Ash `#8A8A99` | labels, metadata, control borders |
| `line` | `#D2D2DA` | Iron `#2C2C35` | dividers only |
| `accent-ink` | Forest `#353D00` | Voltage `#E8FF47` | accent text, borders, rings |
| `danger-ink` | `#A81E15` | Ember `#FF4F4F` | error text and borders |
| `success-ink` | `#046334` | Mint `#3FFFA2` | approved, pass |
| `info-ink` | `#0A5490` | Sky `#47B8FF` | blocked, neutral info |

> **Nothing in the light ramp is pure white, and that is the point.** The first
> version used Bone `#F5F5F7` with `#FFFFFF` cards: a 3.4 step in perceptual
> lightness, with the raised surface at L\* 100 — the maximum, so a card had
> nowhere to go and every hover, border and shadow fought over the last three
> percent. It read as glaring and flat at the same time.
>
> The ramp is now pitched to mirror dark in **L\***, not in contrast ratio —
> ratios compress badly at the light end, so matching them there is what
> produced the flat page. The light lift is 4.4 rather than dark's 5.5 because
> a card also carries a `line` border, which does more of the separating on a
> light ground — matching 5.5 exactly made cards look like they were floating:
>
> | | ground → raised | raised → line |
> |---|---|---|
> | dark | 4.0 → 9.5 (**5.5**) | 9.5 → 18.3 (8.8) |
> | light | 92.2 → 96.6 (**4.4**) | 96.6 → 84.4 (12.2) |

#### The accent rule — one rule, four pairs

**Every accent in the palette fails as text on Bone.** Measured:

| | as text on `surface` (light) | on `surface` (dark) |
|---|---|---|
| Voltage `#E8FF47` | **1.09** ✗ | 17.29 |
| Mint `#3FFFA2` | **1.07** ✗ | 14.73 |
| Sky `#47B8FF` | **1.80** ✗ | 8.79 |
| Ember `#FF4F4F` | **2.65** ✗ | 5.95 |

against the 4.5:1 label bar and WCAG 1.4.11's 3:1 for a control boundary. So
each colour has two halves, and they are not interchangeable:

> **FILL** is the literal — `bg-voltage`, `bg-mint`, `bg-ember`, `bg-sky`. The
> same colour in both themes, and it **always carries Obsidian text** (17.3,
> 14.7, 6.0 and 8.8 to 1). `bg-voltage-dark` is the hover on a Voltage fill.
>
> **INK** is the `*-ink` token — text, borders, rings, icons. Darkened for
> light, collapsing back to the literal in dark. On the light ground:
> `accent-ink` 9.5, `danger-ink` 6.0, `success-ink` 6.1, `info-ink` 6.4.

**Never use a literal for text, a border or a ring. Never use an ink as a
fill.** `scripts/tokens.test.mts` enforces both over the whole app.

Two consequences that are easy to get wrong:

- **`ink-muted` is not a body colour.** 5.6:1 on the light ground misses the
  7:1 body bar. Labels, metadata and captions only — paragraphs use `ink`.
- **`line` is not a control boundary.** 1.23:1 light and 1.40:1 dark: it fails
  the 3:1 bar on *both* grounds. Inputs and other bounded controls take
  `border-ink-muted` (5.6:1 on the ground, 6.4 on a card; 5.7 and 5.1 in dark).
- **A hover fill is a tint of the ink**, `bg-ink/[0.06]`, which darkens on
  light and lightens on dark without a token of its own. `hover:bg-surface-*`
  does not work: on a card it is a no-op, and on the ground it was a near-white
  over a near-white.

#### Two things that are not colours

**Shadow.** `--shadow-card` is themed. At 40% black it is tuned for a dark
ground and reads as a smudge on Bone, so light gets an eighth of the opacity.

**Scrims stay literal.** A drawer or tour overlay is dark on both themes by
design — a scrim that follows the theme stops being a scrim. Mark each with a
`ponytail:` comment.

#### Charts

Recharts takes colours as props, so the admin charts read the CSS custom
properties directly rather than carrying a second palette. A series colour is
a graphical object under WCAG 1.4.11 and needs **3:1 against both grounds** —
which rules out the bright palette: four of the five original colours failed
on Bone. The current set clears 3:1 on Bone and Obsidian alike.

**The theme default is light, with no `prefers-color-scheme` fallback** —
deferring to the OS would make the default unpredictable. The choice persists in
the `th_theme` cookie, read server-side so the first paint is already correct.
`lib/theme.ts` resolves it; `scripts/theme.test.mts` pins the behaviour.

---

### 4.2 Typography

Twnhall uses a **two-font system** — a geometric display font for brand presence, and a monospace UI font that speaks directly to the developer audience.

| Role | Font | Weight | Source |
|------|------|--------|--------|
| **Display / Headings** | [Syne](https://fonts.google.com/specimen/Syne) | Bold (700) | Google Fonts |
| **UI / Body / Code** | [DM Mono](https://fonts.google.com/specimen/DM+Mono) | Regular (400), Medium (500) | Google Fonts |
| **Long-form prose, public surfaces only** | [DM Sans](https://fonts.google.com/specimen/DM+Sans) | Regular (400), Medium (500) | Google Fonts |

> **The DM Sans exception.** Monospace body copy is right inside a developer
> tool and materially harder to read across a pricing page, an about page and
> two guides. DM Sans is scoped to paragraph text in the `(public)` group — UI,
> labels, buttons, badges, code and metadata stay DM Mono everywhere, and app
> surfaces do not get it at all. It is DM Mono's own superfamily, so the two
> share vertical metrics and a mixed setting does not shift baseline.

> **Font rationale:** Syne is angular, geometric, and distinctly modern — it ages well and carries editorial authority. DM Mono brings the developer aesthetic front and centre: monospace fonts communicate precision, code-adjacency, and technical credibility. For a peer testing platform, the font itself signals that Twnhall was built by and for developers.

#### Type Scale (4px grid, base: 16px)

Line height is inversely proportional to font size. Letter spacing is negative for large headings, positive for small labels and buttons. Landing-page headings scale responsively (mobile → desktop values shown).

| Label | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| **Display** | 52 → 80px | 700 | 56 → 84px | −1.5px | Landing hero headline |
| **H1** | 36 → 56px | 700 | 40 → 60px | −0.5px | Final CTA strip headline, large page titles |
| **H2** | 40 → 44px | 700 | 46 → 50px | −0.5px | Landing section headings |
| **H3** | 28px | 600 | 36px | 0px | Card/panel titles |
| **H4** | 22px | 700 | 28px | −0.2px | Cards in How-it-Works grid, sub-section headings |
| **H5** | 20px | 500 | 28px | 0px | Sidebar labels, group headers |
| **Body Large** | 18px | 400 | 28 → 32px | 0px | Landing page paragraphs |
| **Body** | 16px | 400 | 24 → 32px | 0px | Section descriptions, dashboard body text |
| **Body Small** | 14px | 400 | 20 → 24px | 0.1px | Card descriptions, secondary copy |
| **Label** | 12px | 500 | 16px | 0.5–1px | Tags, badges, metadata, eyebrows |
| **Mono / Code** | 13px | 400 | 20px | 0px | URLs, IDs, code snippets |
| **Button** | 14 → 16px | 500 | 20 → 24px | 0.2px | All button text |

> **Accessibility:** All body text must meet **7:1** contrast ratio. Labels and UI elements must meet **4.5:1**. Verify every pairing at [WebAim](https://webaim.org/resources/contrastchecker/).

---

### 4.3 Spacing System (4-Pixel Grid)

Every spacing value — padding, margin, gap, border-radius — must be divisible by 4. No exceptions.

| Token | Value | Use Case |
|-------|-------|----------|
| `space-1` | 4px | Icon-to-label gaps, tight inline spacing |
| `space-2` | 8px | Closely related elements (nav items, tag clusters) |
| `space-3` | 12px | Compact component internal padding |
| `space-4` | 16px | Standard component padding, heading-to-body gap |
| `space-5` | 20px | Card internal padding (top/bottom) |
| `space-6` | 24px | Card internal padding (sides), column gutter |
| `space-8` | 32px | Between unrelated components in a section |
| `space-10` | 40px | Section sub-divisions |
| `space-12` | 48px | Component group separation |
| `space-16` | 64px | Between major page sections |
| `space-24` | 96px | Hero/landing page breathing room |

---

### 4.4 Grid & Layout

| Property | Value |
|----------|-------|
| **Columns** | 12 |
| **Column Width** | 56px |
| **Gutter** | 48px desktop (`gap-12`) → 32px below (`gap-8`) |
| **Max Content Width** | 1,200px — `(56 × 12) + (48 × 11)` |
| **Outer Margin** | 24px mobile (`px-6`) → 32px desktop (`px-8`) |
| **Border Radius (XS)** | 4px — badges, tags, tooltips |
| **Border Radius (SM)** | 8px — buttons, inputs, dropdowns |
| **Border Radius (MD)** | 12px — cards, panels |
| **Border Radius (LG)** | 16px — modals, feature cards, mockup images |
| **Border Radius (Full)** | `9999px` — outlined pill buttons (footer CTA, nav-style pills) |

**Dashboard layout:** Left sidebar 240px fixed + top nav 56px fixed + fluid main content area (max 1,200px centered).

**Landing page layout:** Full-width sections with max-width content container of 1,200px, centered with auto margins. Horizontal padding inside the container: `px-6 lg:px-8`. Section vertical padding: `py-20 lg:py-28` (80–112px) for body sections, `py-16 lg:py-24` for the hero.

**Section dividers:** Thin hairlines (`border-t border-midnight/10`) constrained to the 1,200px content container — never edge-to-edge. Applied above For Testers, Community, and Final CTA sections only. The Hero, How-it-Works, and For-Submitters sections sit without top dividers so the page opens uninterrupted.

---

## 5. Component Library

### 5.1 Buttons

| Variant | Background | Text | Border | Hover |
|---------|-----------|------|--------|-------|
| **Primary** | `#E8FF47` | `#0E0E10` | None | `#C8E000` bg |
| **Secondary** | Transparent | `#F0F0F2` | 1px `#2C2C35` | `#1A1A1F` bg |
| **Ghost** | Transparent | `#8A8A99` | None | `#F0F0F2` text |
| **Destructive** | Transparent | `#FF4F4F` | 1px `#FF4F4F` | `#FF4F4F` bg + `#0E0E10` text |

| Size | Height | Padding H | Font Size |
|------|--------|-----------|-----------|
| **SM** | 32px | 12px | 12px |
| **MD** | 40px | 16px | 14px |
| **LG** | 48px | 24px | 14px |
| **XL** | 56px | 32px | 16px |

All buttons: `border-radius: 8px`, `font-family: DM Mono`, `font-weight: 500`, `letter-spacing: 0.2px`.

> **Rule:** Only one Primary (Voltage) button per viewport. It marks the single most important action. All others use Secondary or Ghost.

---

### 5.2 Form Inputs

Used in: New Project form, New Mission form, Feedback submission form.

| Property | Value |
|----------|-------|
| Height (text input) | 40px |
| Height (textarea) | Auto, min 120px |
| Background | `#1A1A1F` |
| Border | 1px solid `#2C2C35` |
| Border (focus) | 1px solid `#E8FF47` |
| Border (error) | 1px solid `#FF4F4F` |
| Border Radius | 8px |
| Text | `#F0F0F2`, DM Mono 14px |
| Placeholder | `#8A8A99` |
| Padding | 0 16px (inputs) / 12px 16px (textareas) |
| Label | DM Mono 12px, `#8A8A99`, 8px below label |
| Helper text | DM Mono 12px, `#8A8A99`, 4px below input |
| Error text | DM Mono 12px, `#FF4F4F`, 4px below input |
| Character counter | DM Mono 12px, `#8A8A99`, right-aligned below textarea |

**Errors are announced, not just coloured.** Use `components/ui/FieldError` — it
gives the message `id={field}-error` — and spread `fieldErrorProps(field, errors)`
onto the control, which sets `aria-invalid` and `aria-describedby`. Do not write a
bare `<p>`: a red sentence with no relationship to its input is one only sighted
users receive. `components/ui/Field` does the same thing for the flows that use it.

**The control's `name` (or `id`, where there is no form) must equal the schema key
its error arrives under.** That is what lets `useFocusFirstError` find it.

**A failed submit moves the user to the first error.** Call the callback from
`useFocusFirstError()` with the same errors object the form renders — from the
submit handler on a client parse failure, and from an effect on the action state
for a server one. It resolves to the field that is *first in the document*, which
is not the first key of the errors object. A field inside a collapsed section
passes a `reveal` callback so the section opens before the focus lands.

---

### 5.3 Cards

**Standard Card (Dashboard):**

| Property | Value |
|----------|-------|
| Background | `#1A1A1F` |
| Border | 1px solid `#2C2C35` |
| Border Radius | 12px |
| Padding | 24px |
| Shadow | `0 2px 12px rgba(0,0,0,0.4)` |
| Hover | `border-color: rgba(232,255,71,0.3)` |

**Project Card (Community Feed):**
```
┌─────────────────────────────────────────┐
│  Project Name                   [Badge] │  ← H5 Syne / Status badge
│  Brief summary, max 2 lines...          │  ← Body Small DM Mono, Ash color
│                                         │
│  projecturl.com                         │  ← Mono 13px, Sky (#47B8FF)
│  ─────────────────────────────────────  │
│  3 Missions  ·  12 Feedbacks            │  ← Label 12px, Ash
│                            [Test It →]  │  ← Ghost button
└─────────────────────────────────────────┘
```

**Mission Card (inside Project Detail):**
```
┌─────────────────────────────────────────┐
│  01  Mission Title                      │  ← Large Voltage watermark # + H5
│      What to test excerpt...            │  ← Body Small, Ash, max 3 lines
│                                         │
│  4 Feedbacks               [Start →]   │  ← Label 12px + Ghost/Primary button
└─────────────────────────────────────────┘
```

The mission number is displayed as a large, low-opacity (8%) Voltage watermark behind the card title — a deliberate, controlled break in pattern that creates visual rhythm without noise.

---

### 5.4 Status Badges

Color is never the only indicator of status — always paired with a text label.

| Status | Tone | When Used |
|--------|------|-----------|
| **Active** | `info-ink` | Mission is live and accepting testers |
| **Needs Testers** | `accent-ink` | Missions with zero feedback |
| **Complete** | `success-ink` | Mission has sufficient feedback |
| **Draft** / **Archived** | `ink-muted` | Not live. Told apart by the label, per §10 |

> **Active was Mint — the same colour as Complete**, so "this is live" and
> "this is finished" were the same chip. It is info now: blue reads as running
> rather than done, and it leaves green to mean finished. **Needs Testers**
> keeps the accent, because §7.5 names it as one of only two attention-grabbing
> extras the system permits.
>
> A chip is text and a dot — the **ink** half of the accent rule, never the
> fill half. The colours used to live as inline hex in a `style` prop, which is
> the one place a colour hides from both the compiler and a class-based audit;
> every chip read at under 1.1:1 on the light ground for exactly that reason.
> `scripts/tokens.test.mts` now fails on a palette hex anywhere in a component.

All badges: `border-radius: 4px`, `padding: 2px 8px`, `font-size: 12px`, `font-weight: 500`, `letter-spacing: 0.5px`, `font-family: DM Mono`.

---

### 5.5 Navigation

**Top Nav:**
- Height: `56px`, Background: `#0E0E10`, `border-bottom: 1px solid #2C2C35`
- Left: Logo + Twnhall wordmark (Syne Bold, Chalk)
- Center: Global search input, 320px, DM Mono 14px
- Right: "New Project" (Secondary SM) + notification icon + user avatar (32px)

**Sidebar:**
- Width: `240px`, Background: `#0E0E10`, `border-right: 1px solid #2C2C35`

```
  MY WORK                          ← 11px, Ash, uppercase, 1px letter-spacing
  ├── My Projects
  ├── My Missions
  └── Feedback Received

  COMMUNITY
  ├── Explore Projects
  ├── Browse Missions
  └── Recent Activity

  ACCOUNT
  └── Settings
```

- Nav item: height `40px`, `border-radius: 8px`, `padding: 0 12px`, DM Mono 14px
- Active: `background: rgba(232,255,71,0.08)` + `border-left: 3px solid #E8FF47`, Voltage text
- Hover: `background: rgba(255,255,255,0.04)`

**Landing Nav:**
- Height: `64px`, sticky, `backdrop-filter: blur(12px)`
- Background: `rgba(245,245,247,0.85)` Bone with backdrop blur
- Layout: logo far-left, links + Primary CTA grouped together on the far-right (no centered nav)
- Logo: BugPlay icon (20×20, Midnight) + "Twnhall" wordmark (Syne Bold 18px, Midnight)
- Nav links: How It Works | Community — DM Mono 14px, Midnight 70% default → Midnight 100% hover, gap `28–36px` between links
- Gap between link group and CTA: `32–40px` (`gap-8 lg:gap-10`)
- CTA: Primary SM "Start Testing Free" (Voltage bg, Obsidian text, 8px radius) — triggers Google sign-in

---

### 5.6 Settings Sections

`/settings` is a stack of sections rather than one form —
`components/settings/SettingsSection.tsx` is the shared chrome, and there are
five by the end of Stage 3: Profile, Give and take, Plan, Appearance, Export.

| Property | Value |
|----------|-------|
| Section | `surface-raised`, 1px `line`, 12px radius, 32px padding (24px < 640px) |
| Heading | Syne Bold 20px, `ink` |
| Description | DM Sans 14px, `ink`, one line under the heading |
| Metric | value Syne Bold 28px above a DM Mono 12px uppercase label |
| Gap between sections | 40px |

**A metric that has no value renders `—`, never `0`.** An average with nothing
rated and a ratio with nothing received are both *absent*, not zero, and a
zero reads as a bad score rather than as no score. A real zero still renders as
`0.0` — the dash is reserved for the undefined case.

Metrics are one column below 640px. A label and its own figure colliding is
the way a metric row breaks narrow.

---

### 5.6 Comparison Tables

Used on `/pricing`, and by anything else that compares options side by side.

A real `<table>`, never a grid of divs. A screen reader moving cell by cell
through a grid gets values with nothing to attach them to; a table announces
"Tester reports per month, Pro, 20".

| Property | Value |
|----------|-------|
| Row header | `<th scope="row">`, DM Sans 14px, `ink` |
| Column header | `<th scope="col">`, DM Mono 14px Medium, `ink` |
| Cell | DM Mono 14px, `ink` |
| Row divider | 1px `line`, bottom only |
| Caption | `<caption class="sr-only">` naming what is compared |
| Overflow | wrapped in `overflow-x-auto` with `min-w-[520px]` on the table |

**An absent feature is an em dash plus its row header, never an empty cell and
never a colour.** Per §10, colour alone never conveys state — "—" in the
*Shareable report* row reads correctly; a red dot does not. The same rule is
why a tick renders as the word "Included".

The table scrolls inside its own container so the page body never scrolls
horizontally at 360px.

---

### 5.7 Setup Shell

`/terms-accept`, `/choose-account`, `/verify/[role]` —
`components/setup/SetupShell.tsx` and `components/setup/chrome.tsx`.

Three routes that stay three routes, wearing one shell: a 64px top bar with
the wordmark and a context line, the step indicator, then a card. Card is
`surface-raised` on `surface`, 16px radius, 40px padding (24px below 640px).
Column is **640px**, or **760px** on the role picker, which needs two cards
side by side. The bar and indicator are identical across all three — that is
what carries the continuity, not a single width.

**Step indicator.** Two presentations of one model, because a tester's chain is
six stages and six pills do not fit 360px:

| Width | Form |
|---|---|
| ≥640px | Pills. Current is `accent-ink` on an 8% tint; completed carries a tick; upcoming is `ink-muted`. |
| <640px | One line — `Step 3 of 6 · Identity`. |

> **The status comes from the gates, not from a step counter**, so someone
> entering mid-chain sees what they actually completed. And where the tail is
> not yet knowable — the profile portion is three stages for a builder and four
> for a tester, and the role does not exist until the picker is answered — the
> bar renders a trailing `…` rather than a total that is wrong for half of all
> users.

Colour is never the only signal (§10): completed pills carry a tick, and both
the live and completed states are named for screen readers.

---

### 5.8 Auth Card

`/signup`, `/login`, `/forgot-password`, `/reset-password`, `/confirm-email` —
`components/public/AuthCard.tsx`.

A centred card on the tinted public ground: max-width **440px**,
`surface-raised` on `surface`, 16px radius, 40px padding, wordmark above it.
Google sits **above** an "or" divider, not below — it is how every existing
user got here.

Field chrome is §5.2's measurements in semantic tokens: 40px input, 8px radius,
DM Mono 14px, `border-ink-muted` at rest, `border-accent-ink` on focus,
`border-danger-ink` in error. **`components/ui/Field` and `inputClass()` are the
dark-surface spelling of the same thing and must not be used here** — they
would render a dark form inside a light page.

> **A submit button is never disabled to mean "not finished".** It is disabled
> only while the work is in flight, or while a server-side cooldown has not
> elapsed — and the label says which ("Signing you in…", "Resend in 41s"). A
> disabled control that does not explain itself is the failure mode the rule in
> CLAUDE.md exists to prevent.

---

### 5.9 Public Shell

`components/public/` — the header, footer and theme toggle the `(public)` layout
renders around every public page. Public pages do not render their own nav.

**Header:** 64px, sticky, `bg-surface/85` + `backdrop-blur-md`, bottom border
`line`. Logo + Syne wordmark left; marketing nav, theme toggle and the sign-in
CTA right. The CTA is the page's one Voltage fill (§7.2) and always carries
Obsidian text. Below 640px the CTA label shortens to "Sign in" — the full label
does not fit beside the wordmark and toggle at 360px.

**Theme toggle:** 44×44px, sun/moon icon, `aria-label` naming the *destination*
("Switch to dark theme") rather than the current state. Writes the `th_theme`
cookie and refreshes.

**Footer:** four columns on ≥1024px, two on ≥640px, one below. `bg-surface`, top
border `line`, 64px top / 48px bottom padding.

| Brand | Product | Guides | Company & legal |
|---|---|---|---|
| Logo, tagline, "Made in Nigeria 🇳🇬", X | Pricing, About | For builders, For testers | Contact, Privacy policy, Terms of service, Sign in |

"Get started" joins the Guides column when `/signup` exists.

**Mobile sheet:** a native `<dialog>` opened with `showModal()`. The platform
gives the focus trap, `Esc` to close and focus restored to the trigger — do not
hand-roll those. The theme toggle and the sign-in CTA stay in the bar at every
width rather than moving into the sheet.

> **Never add a nav or footer entry before its page exists.** A column whose
> pages have not shipped is omitted, not stubbed — no `href="#"`, no "coming
> soon". Both live as arrays in their components; adding an entry is a one-line
> change in the PR that creates the destination.

---

## 6. Page Specifications

### 6.1 Landing Page

**Goal:** Communicate the peer-testing concept clearly and convert developers to signups.  
**Primary CTA:** "Start Testing Free" (nav + footer + final strip) — all trigger Google sign-in via `signInWithGoogle` form action.

**① Hero**
- Centered single-column copy stack: headline → subtitle → CTA → full-width dashboard mockup below
- Headline (Display, 52→80px, Syne Bold, `tracking-[-1.5px]`): *"Ship better. Test each other."*
- Subtitle (Body Large, 18px DM Mono, `leading-7→8`, `max-w-2xl`): the submit → test → feedback loop in 1–2 sentences
- Single CTA: Ghost "Explore Projects →" (with trailing `ArrowRight` icon) — triggers Google sign-in
- Background: `#F5F5F7` Bone + subtle dot-grid overlay `rgba(0,0,0,0.03)`
- Padding: `py-16 lg:py-24` (64–96px)
- Hero mockup: `/images/hero-wireframe.svg` — full-width, `rounded-[16px]`, `shadow-[0_16px_40px_rgba(0,0,0,0.2)]`

**② How The Loop Works** *(critical — explains the reciprocity model upfront)*
- 3-step grid with hairline divider treatment — `border-y border-midnight/10` framing the row, `divide-x divide-midnight/10` between cards on desktop (`divide-y` between cards on mobile)
- Grid spans edge-to-edge of the 1,200px container via `-mx-6 lg:-mx-8`; each card re-applies `px-6 lg:px-8 pt-14 pb-10 lg:pt-16 lg:pb-12` so content aligns with the section heading above
- Card minimum height: `240px` for uniform card heights regardless of copy length
- Step number: small label `01 / 02 / 03` in top-right corner — Syne Bold 12px, `tracking-[1px]`, Midnight 30% (replaced the large background watermark)
- Each card: 44×44 Graphite icon tile (`rounded-[8px]`, `border border-iron`) with Voltage icon (20×20) → H4 title (22px Syne Bold) → Body Small copy (14px DM Mono, Midnight 60%, `leading-6`)
- Section eyebrow: "THE LOOP" — Label 12px DM Mono Medium, Forest, uppercase, `tracking-[1px]`
- Section heading: "How it works." (H2)
- Background: `#F5F5F7` Bone (light theme — sits in the page's light flow, not the dark contrast strip from v1)
- Padding: `py-20 lg:py-28`

**③ For Submitters**
- 2-col grid (6/6 on desktop), `items-center`: copy left + UI mockup right
- Section eyebrow: "FOR SUBMITTERS" (Forest, uppercase, `tracking-[1px]`)
- Heading (H2): *"Structured feedback,<br />not guesses."*
- Description: 3-sentence narrative paragraph (16px DM Mono, Midnight 70%, `leading-8`, `max-w-md`) — no bullet list, no inline CTA. Length is tuned so the text block visually balances the image height.
- Mockup: `/images/submit-project-form.svg` (600×440, `rounded-[16px]`, soft shadow)
- Padding: `py-20 lg:py-28`

**④ For Testers**
- Mirrored 2-col grid: UI mockup left + copy right (orders flip on mobile so mockup stacks below copy)
- Same heading/description/no-CTA treatment as For Submitters
- Mockup: `/images/mission-card.svg` (600×370)
- Section divider: hairline `border-t border-midnight/10` above this section
- Padding: `py-20 lg:py-28`

**⑤ Community Proof**
- Centered heading block: H2 ("Projects waiting for your feedback right now") + sub-paragraph (15px DM Mono, Midnight 60%, `leading-7`), wrapped in `max-w-2xl mx-auto`
- Below: full-width `community-cards.svg` mockup (1,104×226) — 3 sample project cards
- Section divider: hairline above
- Padding: `py-20 lg:py-28`

**⑥ Final CTA Strip**
- Centered single column inside the 1,200px container
- Headline (H1, 36→56px Syne Bold, `max-w-3xl`): *"Your next release deserves real feedback."*
- Single CTA: Primary XL "Start Testing Free" (Voltage, Obsidian text, `h-14 px-8`, 16px radius optional) — triggers Google sign-in
- Section divider: hairline above
- Background: `#F5F5F7` Bone (no longer dark)
- Padding: `py-20 lg:py-28`

**⑦ Footer**
- Two-region layout: brand block left + 2 link columns right (`flex-col lg:flex-row lg:justify-between`)
- **Brand block** (`max-w-sm`):
  - BugPlay icon (24×24, Voltage) + "Twnhall" wordmark (22px Syne Bold, Chalk)
  - Tagline: "Ship with confidence. Test each other." (14px DM Mono, Ash 80%, `leading-6`)
  - Outlined pill CTA: "Start Testing Free" — `h-10 px-5`, `rounded-full`, `border border-ash/30`, Chalk text, DM Mono Medium 13px. Hover: `bg-chalk/[0.06]` + `border-chalk/40`. Triggers Google sign-in.
- **Link columns** (gap `64–96px`):
  - **Product**: How it Works · Explore Projects
  - **Community**: Guidelines · X (Twitter)
  - Column heading: DM Mono Medium 13px, Chalk, `mb-2`
  - Link items: DM Mono 13px, Ash, hover Chalk
- **Bottom row**: inline copyright + Privacy Policy · Terms of Service, separated by middle-dot `·` glyphs (Ash 30%, 10px). All items DM Mono 12px, Ash 60%, hover Chalk on links.
- Divider between upper area and bottom row: `border-t border-iron pt-6` (the outer `border-top` from v1 is removed)
- Background: `#0E0E10` Obsidian
- Padding: `py-16 lg:py-20` (64–80px)

---

### 6.2 My Projects (Dashboard)

User acting as **Submitter**. Managing their own submissions.

- Page title: "My Projects" (H2, Syne) + "New Project" Primary MD button (top right)
- Grid of Project Cards — 2-col desktop, 1-col mobile, gap `24px`
- Each card links to that project's detail page
- Empty state: see Section 8

---

### 6.3 New Project Form

**Context:** Submitter creating a project for community testing.

- Single-column, max-width `640px`, centered
- Form card: `background: #1A1A1F`, `border-radius: 16px`, `padding: 40px`
- Title: "Submit a Project" (H2, Syne) + "Tell the community what you've built." (Body, Ash)
- Fields (vertical gap: `24px`):
  - **Project Name** — text input, required, max 80 chars
  - **Project URL** — URL input, required, validated on blur with inline error
  - **Brief Summary** — textarea, required, max 300 chars, live character counter
- Below fields: "What happens next?" explainer (Body Small, Ash) — 3 bullet points describing the submission → mission → feedback flow
- CTAs: Primary LG "Create Project" + Ghost "Cancel"

---

### 6.4 Project Detail Page

**Context:** Inside a specific project. Submitter manages missions and reviews feedback.

- Breadcrumb: `My Projects / Project Name` — DM Mono 13px, Ash
- Header: Project Name (H1, Syne) + URL (Sky, linked, Mono 13px) + Status badge + Summary (Body, Ash)
- Two-tab layout (Voltage underline slide, 200ms):
  - **Missions** (default) — "Add Mission" Secondary MD button top-right
  - **Feedback Received**

**Missions tab:** Stacked full-width Mission Cards, gap `16px`.

**Feedback Received tab:**
- Feedback grouped by mission (H5 section heading)
- Each item: tester label ("Developer #04", DM Mono 12px, Ash) + feedback body (Body) + timestamp (Label, Ash)
  - Below feedback body: screenshot thumbnail (`border-radius: 8px`, max-height `160px`, `object-fit: cover`, full width of feedback column) with "View full screenshot" Ghost SM link below it
  - `border-left: 3px solid #2C2C35`, `padding-left: 16px`, item gap `16px`

---

### 6.5 New Mission Form

**Context:** Submitter adding a testable mission to an existing project.

- Single-column, max-width `640px`, centered, same form card style as New Project
- Title: "Create a Mission" (H2, Syne) + "For: [Project Name]" (Body Small, Ash)
- Fields (vertical gap: `24px`):
  - **Mission Title** — text input, required, max 100 chars
    - Placeholder: *"e.g. Test the checkout flow"*
  - **What to Test** — textarea, required, recommended 500 char minimum
    - Placeholder: *"Describe exactly what you want testers to do and what feedback you're looking for..."*
    - Helper: *"Be specific. The clearer your instructions, the better feedback you'll receive."*
- CTAs: Primary LG "Publish Mission" + Ghost "Save as Draft"

---

### 6.6 Explore — Community Feed

**Context:** User acting as **Tester**. Browsing all live community projects.

- Page title: "Explore Projects" (H2, Syne) + "Find something to test." (Body, Ash)
- Filter pills: All | Needs Testers | Recently Added | Most Missions
  - Active: `background: rgba(232,255,71,0.12)`, `border: 1px solid rgba(232,255,71,0.4)`, Voltage text
  - Inactive: `background: #1A1A1F`, Iron border, Ash text
  - `border-radius: 20px`, `padding: 8px 16px`, `height: 32px`
- Search input (right of filters): 280px, DM Mono 14px
- Grid: 2-col Project Cards, gap `24px`
- Pagination: "Load More" Secondary MD button, centered, `margin-top: 40px`

---

### 6.7 Mission Detail Page

**Context:** Tester has selected a mission. Core testing interaction screen.

- Single column, max-width `800px`, centered
- Breadcrumb: `Explore / Project Name / Mission Title`
- Mission title (H2, Syne)
- Project context card (`background: #1A1A1F`, `border-radius: 12px`, `padding: 20px 24px`):
  - Project Name (H5) + URL (Sky, new tab, Mono 13px) + Summary (Body Small, Ash)
- Mission instructions block:
  - Label: "YOUR MISSION" — DM Mono 11px, Voltage, uppercase, `letter-spacing: 1px`
  - Content: `background: rgba(232,255,71,0.05)`, `border-left: 3px solid #E8FF47`, `border-radius: 0 8px 8px 0`, `padding: 16px 20px`
  - Text: Body 16px, DM Mono, Chalk
- Primary LG "Open Project in New Tab" → opens URL, triggers feedback form reveal
- Feedback form (300ms fade-in after URL opened):
  - Label: "YOUR FEEDBACK" — DM Mono 11px, Voltage, uppercase, `letter-spacing: 1px`
  - **Written Feedback** — textarea, min-height `160px`, placeholder: *"Share what you found — be specific and constructive."*
    - Helper: *"Great feedback is at least 100 characters."* (soft minimum with inline warning)
  - **Screenshot Upload** (required):
    - Label: "SCREENSHOTS OF YOUR TEST" — same label style as above, `margin-top: 24px`.
      Names the artefact, not its purpose: a first-time tester read "Proof of Visit"
      and did not know a screenshot was wanted. The builder-side header is
      "TEST SCREENSHOTS". The *reasoning* in §1 — that the screenshot is evidence
      of a real visit as well as visual context — is unchanged and still the point.
    - Helper text (Body Small, Ash): *"Upload a screenshot from the project — this confirms you visited and provides visual context for your feedback."*
    - Upload zone: `background: #1A1A1F`, `border: 1px dashed #2C2C35`, `border-radius: 12px`, `padding: 32px`, min-height `140px`
    - Upload zone content (centered): upload icon (24px, Ash) + "Drop your screenshot here" (Body Small, Ash) + "or browse files" (Body Small, Voltage, clickable)
    - Upload zone hover: `border-color: rgba(232,255,71,0.4)`, `background: rgba(232,255,71,0.03)`
    - Upload zone drag-active: `border-color: #E8FF47`, `background: rgba(232,255,71,0.06)`
    - Accepted formats: PNG, JPG, WEBP — max 5MB. Enforced with inline error if exceeded.
    - After upload: zone is replaced by image thumbnail preview (`border-radius: 8px`, full width, max-height `240px`, `object-fit: cover`) + filename (DM Mono 12px, Ash) + "Remove" Ghost SM button below
    - Error state (wrong format/size): `border-color: #FF4F4F`, Ember error text below zone: *"File must be PNG, JPG, or WEBP under 5MB."*
  - Submit is disabled until both written feedback (100+ chars) and screenshot are provided
  - CTAs: Primary LG "Submit Feedback" (disabled state: `opacity: 0.4`, `cursor: not-allowed`) + Ghost "Save Draft"

---

### 6.8 Settings

- Single column, max-width `640px`, centered
- Sections: Profile | Account | Notifications | Danger Zone
- Section separator: `32px` gap + `1px solid #2C2C35` divider
- Section titles: H5, Syne
- Danger Zone: Ember-colored section title, Destructive button for account deletion

---

## 7. Visual Hierarchy Rules

Applied from the DesignSpo framework, ranked and mapped to Twnhall:

1. **Size** — One Display or H1 per page anchors the eye. Mission watermark numbers are a scaled, intentional exception that creates rhythm, not competition.
2. **Color (Voltage)** — One Primary CTA per viewport, never decorative. The moment it appears on two things, it stops meaning anything.
3. **White space** — The Mission Instructions block (Voltage left-border + tinted background) is surrounded by neutral space. It becomes the natural focal point without competing for attention.
4. **Weight** — Syne Bold (700) for headings. DM Mono Medium (500) for card titles, nav items, buttons. Regular (400) for everything else. Weight creates scannability.
5. **Extra elements** — "Needs Testers" badge and "Most Popular" pricing tag are the only attention-grabbing extras permitted. Scarcity keeps them meaningful.
6. **Misalignment** — Voltage watermark numbers on landing steps and mission cards are oversized, low-opacity, and deliberately off-scale. Controlled breaks in pattern create interest without chaos.

---

## 8. Empty States

| Screen | Heading | Copy | CTA |
|--------|---------|------|-----|
| My Projects (none) | "Nothing here yet." | "Submit your first project and let the community test it." | "New Project" (Primary) |
| Missions (none on project) | "No missions added." | "Add a mission to tell testers what to focus on." | "Add Mission" (Primary) |
| Feedback Received (none) | "No feedback yet." | "Share your project in the community to start receiving feedback." | "Explore Community" (Ghost) |
| Explore (no results) | "Nothing matches." | "Try a broader search or clear your filters." | Clear filters (Ghost) |

Empty state layout: centered icon 48×48px (Ash, `margin-bottom: 16px`) + H4 (Syne) + Body Small (Ash, `margin-top: 8px`) + CTA (`margin-top: 24px`). Vertical padding: `64px 0`.

---

## 9. Motion & Interaction

| Interaction | Animation | Duration | Easing |
|-------------|-----------|----------|--------|
| Landing page load | Staggered fade-up (hero elements) | 400ms, 100ms stagger | `ease-out` |
| Button hover | Background/color transition | 150ms | `ease` |
| Card hover | Border shifts to Voltage at 30% opacity | 150ms | `ease` |
| Filter pill switch | Background fill | 200ms | `ease-in-out` |
| Tab underline | Position slide | 200ms | `ease-in-out` |
| Feedback form unlock | Fade-in after URL opened | 300ms | `ease-out` |
| Screenshot drag-over | Border + background tint transition | 150ms | `ease` |
| Screenshot upload success | Fade out dropzone → fade in preview | 250ms | `ease-out` |
| Feedback submit success | Border flashes Mint → success state | 400ms | `ease` |
| Modal open | Fade + scale 96% → 100% | 200ms | `ease-out` |
| Toast notification | Slide in from bottom-right | 250ms | `spring` |
| Sidebar nav hover | Background fill | 120ms | `ease` |

No infinite animations. No looping effects. Motion nudges attention once, then stops.

---

## 10. Accessibility Checklist

- [ ] Body text ≥ **7:1** contrast — verify at [WebAim](https://webaim.org/resources/contrastchecker/)
- [ ] UI labels and large headings ≥ **4.5:1** contrast
- [x] All interactive elements have `:focus-visible` — `outline: 2px solid #E8FF47; outline-offset: 2px`
      Spelled as a ring in Tailwind, per `components/ui/Button.tsx`:
      `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-voltage focus-visible:ring-offset-2 focus-visible:ring-offset-<surface>`.
      The offset colour follows the surface behind the control — `obsidian` in the
      sidebar and on page ground, `graphite` inside a card.
- [ ] All form inputs have visible, associated `<label>` elements
- [ ] All icon-only buttons have `aria-label`
- [ ] Status badges always pair color with a text label — color alone never conveys state
- [ ] Keyboard navigation follows logical tab order throughout
- [ ] Minimum tap target: **44×44px** on mobile
- [ ] All external links use `target="_blank" rel="noopener noreferrer"`
- [ ] Character counters update in real-time and are screen reader accessible
- [ ] Feedback form unlock communicated via `aria-live` region, not visual reveal alone
- [ ] Screenshot upload zone is keyboard accessible and has clear `aria-label`
- [ ] Upload errors are announced via `aria-live` for screen readers
- [ ] Submit button disabled state communicates reason via `aria-describedby` (not just visual opacity)

---

## 11. Tone of Voice

Twnhall speaks peer-to-peer — like a sharp, collegial developer, not a SaaS marketing page.

| Do | Don't |
|----|-------|
| "Ship better. Test each other." | "Unlock powerful user insights for your team." |
| "Add a mission. Tell testers exactly where to look." | "Create test scenarios to guide your testing journey." |
| "4 developers have already tested this." | "Leverage community-driven feedback at scale." |
| "Be specific. Better instructions = better feedback." | "Empower testers to share meaningful observations." |
| "Your project is live. Now go test someone else's." | "Start your collaborative testing experience today." |
| "Nothing here yet. Submit your first project." | "Your workspace is empty. Get started today!" |

- Short sentences. Active voice. Peer-to-peer energy.
- Avoid: "seamless," "powerful," "robust," "leverage," "unlock," "journey," "empower," "intuitive."
- CTAs are always action-verb first: "Submit Project," "Add Mission," "Start Testing," "Submit Feedback," "Explore Projects."

---

## 12. Design Tool References

| Purpose | Tool | URL |
|---------|------|-----|
| Contrast checking | WebAim Contrast Checker | https://webaim.org/resources/contrastchecker/ |
| Palette generation | Coolors | https://coolors.co |
| Voltage tint/shade scale | UI Colors | https://uicolors.app |
| Color harmony exploration | Adobe Color | https://color.adobe.com |
| Font preview & pairing | Google Fonts | https://fonts.google.com |
| Grid math | Grid Calculator | https://gridcalculator.dk |

---

## 13. Quick Reference Cheat Sheet

```
COLORS — Dashboard (Dark)
  Background:     #0E0E10   Obsidian
  Surface:        #1A1A1F   Graphite
  Border:         #2C2C35   Iron
  Text Primary:   #F0F0F2   Chalk
  Text Secondary: #8A8A99   Ash
  Accent:         #E8FF47   Voltage
  Accent Hover:   #C8E000   Voltage Dark
  Success:        #3FFFA2   Mint
  Error:          #FF4F4F   Ember
  Info / Links:   #47B8FF   Sky

COLORS — Public surfaces (semantic, resolve per theme)
                  LIGHT               DARK
  surface:        #F5F5F7  Bone       #0E0E10  Obsidian
  surface-raised: #FFFFFF             #1A1A1F  Graphite
  ink:            #0E0E10  Obsidian   #F0F0F2  Chalk
  ink-muted:      #5A5A66             #8A8A99  Ash
  line:           #E2E2E8             #2C2C35  Iron
  accent (fill):  #E8FF47  Voltage    #E8FF47  Voltage
  accent-ink:     #353D00  Forest     #E8FF47  Voltage

FONTS
  Headings:  Syne Bold 700
  UI & Body: DM Mono Regular 400 / Medium 500
  Public prose only: DM Sans Regular 400 / Medium 500

TYPE SCALE (px) — landing headings scale responsively
  Display 52→80 | H1 36→56 | H2 40→44 | H3 28 | H4 22 | H5 20
  Body Large 18 | Body 16 | Body Small 14 | Mono 13 | Label 12

SPACING TOKENS (px) — all divisible by 4
  4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96 / 112

GRID
  12 columns | 56px wide | 48px gutter (lg) / 32px gutter (md) | 1,200px max width
  Outer padding: px-6 mobile → px-8 desktop (24px → 32px)

BORDER RADIUS
  4px badges/tags | 8px buttons/inputs | 12px cards | 16px modals/mockups | 9999px pill CTAs

BUTTON HEIGHTS
  32px SM | 40px MD | 48px LG | 56px XL

KEY RULES
  → One Voltage CTA per viewport. No exceptions.
  → Voltage is a FILL only on light. Forest is the accent ink there.
  → Literal tokens on app surfaces, semantic tokens on public surfaces.
  → All spacing divisible by 4. No exceptions.
  → Body text: 7:1 contrast min. Labels: 4.5:1 min.
  → Line height inversely proportional to font size.
  → Letter spacing: negative for large text, positive for small.
  → Color alone never conveys state — always pair with text label.
  → Submitter flow = structured + deliberate.
  → Tester flow = lightweight + fast.
```

---

*Design brief v2.1 — Twnhall, peer usability testing platform for developers. All decisions grounded in the DesignSpo framework: 4-pixel grid system, HSB color theory, visual hierarchy by contrast, and typographic hierarchy by scale. v2.1 updates landing-page grid to 1,200px max width, responsive heading scale, and revised landing section specs (light How-it-Works, dividers, restructured footer).*
