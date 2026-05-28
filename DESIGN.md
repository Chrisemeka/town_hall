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

> Chalk (`#F0F0F2`) on Obsidian (`#0E0E10`) ≈ **14.5:1** — exceeds WCAG AAA.  
> Ash (`#8A8A99`) on Obsidian ≈ **5.2:1** — meets WCAG AA.  
> Voltage (`#E8FF47`) on Obsidian ≈ **13.5:1** — exceeds WCAG AAA.  
> Verify all new color pairings at WebAim before use.

---

### 4.2 Typography

Twnhall uses a **two-font system** — a geometric display font for brand presence, and a monospace UI font that speaks directly to the developer audience.

| Role | Font | Weight | Source |
|------|------|--------|--------|
| **Display / Headings** | [Syne](https://fonts.google.com/specimen/Syne) | Bold (700) | Google Fonts |
| **UI / Body / Code** | [DM Mono](https://fonts.google.com/specimen/DM+Mono) | Regular (400), Medium (500) | Google Fonts |

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

| Status | Text Color | Background | When Used |
|--------|-----------|------------|-----------|
| **Active** | `#E8FF47` | `rgba(232,255,71,0.12)` | Mission is live and accepting testers |
| **Complete** | `#3FFFA2` | `rgba(63,255,162,0.12)` | Mission has sufficient feedback |
| **Draft** | `#8A8A99` | `rgba(138,138,153,0.12)` | Saved but not yet published |
| **Needs Testers** | `#47B8FF` | `rgba(71,184,255,0.12)` | Missions with zero feedback |
| **Archived** | `#44444F` | `rgba(44,44,53,0.5)` | No longer active |

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
    - Label: "PROOF OF VISIT" — same label style as above, `margin-top: 24px`
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
- [ ] All interactive elements have `:focus-visible` — `outline: 2px solid #E8FF47; outline-offset: 2px`
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

COLORS — Landing Page (Light)
  Background:     #F5F5F7   Bone
  Surface:        #FFFFFF
  Text:           #0E0E10   Midnight

FONTS
  Headings:  Syne Bold 700
  UI & Body: DM Mono Regular 400 / Medium 500

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
