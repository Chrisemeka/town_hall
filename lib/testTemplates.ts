import type { TestCategory } from "@/lib/vocabulary"

/**
 * Curated starting points for a test case.
 *
 * Static TypeScript, not a database table. These are content the team writes
 * and edits, not user data — a table would mean a migration every time someone
 * fixes a typo in a step, and a seed script to keep environments in step.
 * Revisit only if builders ever need to save their own.
 *
 * A template is **copied** onto a mission, never referenced by it. Steps get
 * fresh ids at instantiation and `missions.template_id` records provenance
 * only, so editing a template here can never change a mission somebody already
 * built from it.
 */
export type TestTemplate = {
  /** Stored on missions.template_id. Stable — renaming one orphans provenance. */
  id: string
  category: TestCategory
  name: string
  /** One line, shown in the picker. */
  description: string
  steps: { action: string; expected_result: string }[]
}

export const TEST_TEMPLATES: TestTemplate[] = [
  /* ── Process flow ──────────────────────────────────────────────────── */
  {
    id: "auth-flow",
    category: "process_flow",
    name: "Authentication Flow",
    description: "Sign up, verify, sign in, sign out.",
    steps: [
      { action: "Open the app and start creating a new account", expected_result: "A sign-up form appears asking for the details you would expect" },
      { action: "Submit the form with a valid email and password", expected_result: "The account is created and you are told what happens next" },
      { action: "Complete any email or phone verification you are sent", expected_result: "Verification succeeds and you reach the signed-in app" },
      { action: "Sign out, then sign back in with the same credentials", expected_result: "You land back in the app with your account intact" },
      { action: "Try signing in with a deliberately wrong password", expected_result: "You are refused with a message that says what went wrong" },
    ],
  },
  {
    id: "password-reset",
    category: "process_flow",
    name: "Password Reset",
    description: "Forgotten password, all the way back to signed in.",
    steps: [
      { action: "From the sign-in screen, start the forgotten-password flow", expected_result: "You are asked for the email on the account" },
      { action: "Submit an email address that has no account", expected_result: "The app does not reveal whether that account exists" },
      { action: "Submit the email of a real account and open the link you receive", expected_result: "The link opens a form to set a new password" },
      { action: "Set a new password and sign in with it", expected_result: "The new password works and the old one no longer does" },
    ],
  },
  {
    id: "checkout-payment",
    category: "process_flow",
    name: "Checkout / Payment",
    description: "Cart through to confirmation, including a failed payment.",
    steps: [
      { action: "Add an item to the cart and open the cart", expected_result: "The item, quantity and price are all correct" },
      { action: "Change the quantity, then remove an item", expected_result: "Totals update immediately and match the arithmetic" },
      { action: "Go through checkout with valid test payment details", expected_result: "Payment succeeds and you get a confirmation with an order reference" },
      { action: "Repeat checkout with a card that will be declined", expected_result: "The failure is explained and nothing is charged or ordered" },
    ],
  },
  {
    id: "onboarding-flow",
    category: "process_flow",
    name: "Onboarding",
    description: "First run, from empty state to first real action.",
    steps: [
      { action: "Sign in as a brand-new user and look at the first screen", expected_result: "It is clear what this product is for and what to do first" },
      { action: "Follow the onboarding through to the end", expected_result: "Every step explains why it is asking, and none of it is a dead end" },
      { action: "Try to skip or dismiss the onboarding", expected_result: "Skipping is possible and does not leave the account half-configured" },
      { action: "Complete the first real action the product is for", expected_result: "You get there without having to guess or go back" },
    ],
  },

  /* ── Component ─────────────────────────────────────────────────────── */
  {
    id: "form-inputs",
    category: "component",
    name: "Form Inputs & Validation",
    description: "Fields, error states, and what happens on submit.",
    steps: [
      { action: "Submit the form completely empty", expected_result: "Every required field is flagged, and the message says what is needed" },
      { action: "Enter deliberately invalid values — a bad email, a short password", expected_result: "Each error appears next to the field it belongs to" },
      { action: "Fix the errors one at a time", expected_result: "Each message clears as soon as its field becomes valid" },
      { action: "Submit the completed form twice in quick succession", expected_result: "It does not submit twice or create a duplicate" },
    ],
  },
  {
    id: "buttons-states",
    category: "component",
    name: "Buttons & Interactive States",
    description: "Hover, focus, disabled, loading, and keyboard reach.",
    steps: [
      { action: "Hover over the main buttons on the page", expected_result: "Each gives visible feedback and the cursor says it is clickable" },
      { action: "Tab through the page using only the keyboard", expected_result: "Focus is always visible and the order follows the layout" },
      { action: "Trigger an action that takes a moment", expected_result: "The button shows it is working and cannot be pressed again" },
      { action: "Find any disabled button and try to use it", expected_result: "It does nothing, and it is clear why it is unavailable" },
    ],
  },
  {
    id: "modals-overlays",
    category: "component",
    name: "Modals & Overlays",
    description: "Opening, dismissing, and what happens underneath.",
    steps: [
      { action: "Open a modal or dialog", expected_result: "It takes focus and the page behind it stops scrolling" },
      { action: "Close it with Escape, then reopen and close it by clicking outside", expected_result: "Both dismiss it, and neither loses work you had entered" },
      { action: "Open a modal containing a form and tab through it", expected_result: "Focus stays inside the modal until it is closed" },
      { action: "Resize the window with the modal open", expected_result: "It stays usable and nothing is cut off or unreachable" },
    ],
  },
  {
    id: "navigation-menus",
    category: "component",
    name: "Navigation & Menus",
    description: "Getting around, and knowing where you are.",
    steps: [
      { action: "Visit every top-level destination in the navigation", expected_result: "Each one loads, and the nav shows which is current" },
      { action: "Use the browser back button after navigating a few times", expected_result: "You go back where you expect, with nothing stale on screen" },
      { action: "Open any dropdown or nested menu", expected_result: "It opens, closes on a second click, and closes on Escape" },
      { action: "Reload the page on a deep link", expected_result: "It loads that page directly rather than bouncing you home" },
    ],
  },

  /* ── UI design ─────────────────────────────────────────────────────── */
  //
  // These read as prompts rather than assertions on purpose. "Expected result"
  // is subjective here, and pretending otherwise would push testers toward a
  // pass/fail they cannot honestly give. PR 4's audit log has to accept a
  // judgement against these, not just a tick.
  {
    id: "first-impression",
    category: "ui_design",
    name: "First Impression & Clarity",
    description: "What the product appears to be, in the first few seconds.",
    steps: [
      { action: "Land on the homepage and describe your first impression", expected_result: "The purpose of the product is clear within about five seconds" },
      { action: "Say who you think this is built for", expected_result: "The intended audience is obvious without scrolling or guessing" },
      { action: "Point at what you think the main action is", expected_result: "One action is clearly the most important thing on the screen" },
    ],
  },
  {
    id: "visual-hierarchy",
    category: "ui_design",
    name: "Visual Hierarchy & Readability",
    description: "Where the eye goes, and whether the text is comfortable.",
    steps: [
      { action: "Scan the page without reading it, and note the order things caught your eye", expected_result: "The order matches what actually matters on the page" },
      { action: "Read a full paragraph of body text", expected_result: "Size, spacing and contrast make it comfortable rather than effortful" },
      { action: "Find the least readable thing on the page", expected_result: "Nothing important is hard to read" },
    ],
  },
  {
    id: "mobile-responsiveness",
    category: "ui_design",
    name: "Mobile Responsiveness",
    description: "How the layout holds up on a small screen.",
    steps: [
      { action: "Open the page on a phone, or at a phone-sized window", expected_result: "Nothing overflows, overlaps, or scrolls sideways" },
      { action: "Tap the main buttons and links with a thumb", expected_result: "Targets are big enough to hit without care" },
      { action: "Rotate to landscape and back", expected_result: "The layout adapts without losing your place" },
    ],
  },
  {
    id: "consistency-polish",
    category: "ui_design",
    name: "Consistency & Polish",
    description: "Whether it feels like one product built by one team.",
    steps: [
      { action: "Compare buttons, spacing and type across three different screens", expected_result: "They look like the same product, not three" },
      { action: "Look for anything unfinished — placeholder text, broken images, cut-off labels", expected_result: "Nothing on screen looks unfinished" },
      { action: "Trigger an error and an empty state", expected_result: "Both are designed, and both say what to do next" },
    ],
  },
]

/** Templates for one category, in declaration order. */
export function templatesFor(category: TestCategory): TestTemplate[] {
  return TEST_TEMPLATES.filter((t) => t.category === category)
}

/**
 * A template's steps as mission steps, with ids minted fresh.
 *
 * Fresh ids are what make the copy a copy. Reusing the template's own ids would
 * make two missions built from one template share step ids, and PR 4's audit
 * entries key off exactly that.
 */
export function instantiate(template: TestTemplate) {
  return template.steps.map((step) => ({
    id: crypto.randomUUID(),
    action: step.action,
    expected_result: step.expected_result,
  }))
}
