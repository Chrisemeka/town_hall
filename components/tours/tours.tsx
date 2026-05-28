import type { Step } from "onborda/dist/types"

export type Tour = { tour: string; steps: Step[] }

export const TOURS: Tour[] = [
  {
    tour: "explore",
    steps: [
      {
        icon: "🛰️",
        title: "Welcome to Explore",
        content: <>This is the main feed. Every active project from the community lives here, waiting to be tested.</>,
        selector: "#tour-explore-header",
        side: "bottom",
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 8,
      },
      {
        icon: "🎯",
        title: "Filter and search",
        content: <>Filter by recency or search by name to find a project. Click any card below to see its missions and pick one up.</>,
        selector: "#tour-explore-filters",
        side: "bottom",
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 10,
      },
      {
        icon: "🚀",
        title: "Submit your own work",
        content: <>When you're ready to get feedback on something you've built, hit <span className="font-medium">New Project</span> in the top-right.</>,
        selector: "#tour-new-project-btn",
        side: "bottom-right",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 8,
      },
    ],
  },
  {
    tour: "my-projects",
    steps: [
      {
        icon: "📁",
        title: "Your projects live here",
        content: <>Every project you've submitted shows up on this page. Open one to see its missions and the feedback you've received.</>,
        selector: "#tour-my-projects-header",
        side: "bottom",
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 8,
      },
      {
        icon: "➕",
        title: "Submit a new project",
        content: <>Click <span className="font-medium">New Project</span> in the top nav to add another one.</>,
        selector: "#tour-new-project-btn",
        side: "bottom-right",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 8,
      },
    ],
  },
  {
    tour: "new-project",
    steps: [
      {
        icon: "✏️",
        title: "Tell us about your project",
        content: <>Add a name, public URL, and a short description. Testers see this on the Explore feed — the clearer it is, the better the feedback.</>,
        selector: "#tour-new-project-header",
        side: "bottom",
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 10,
      },
      {
        icon: "⚠️",
        title: "Don't forget the missions",
        content: <>A project stays in <span className="font-medium">DRAFT</span> until you add at least one mission to it. Without a mission, your project will <span className="font-medium">not appear on Explore</span> — so head to <span className="font-medium">My Projects</span> right after submitting to add one.</>,
        selector: "#tour-new-project-next",
        side: "top",
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 10,
      },
    ],
  },
  {
    tour: "project-missions",
    steps: [
      {
        icon: "🔍",
        title: "Check out the project",
        content: <>Here's what you'll be testing. Read the summary and open the live site to see it for yourself.</>,
        selector: "#tour-project-overview",
        side: "bottom",
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 10,
      },
      {
        icon: "🚀",
        title: "Pick a mission",
        content: <>Choose a mission and hit <span className="font-medium">Start</span> to read the brief and submit your feedback.</>,
        selector: "#tour-project-missions",
        side: "bottom",
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 10,
      },
    ],
  },
  {
    tour: "browse-missions",
    steps: [
      {
        icon: "🗺️",
        title: "Every open mission",
        content: <>Every open mission in one place. Tap one to read the brief and leave feedback.</>,
        selector: "#tour-browse-missions-header",
        side: "bottom",
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 8,
      },
    ],
  },
  {
    tour: "mission-submission",
    steps: [
      {
        icon: "📝",
        title: "Read the brief first",
        content: <>The submitter wrote this to tell you exactly what to test. Read it carefully — staying on brief is what makes feedback useful.</>,
        selector: "#tour-mission-brief",
        side: "bottom",
        showControls: true,
        pointerPadding: 10,
        pointerRadius: 12,
      },
      {
        icon: "🌐",
        title: "Visit the project",
        content: <>Open the project URL in a new tab and walk through it as a real user would.</>,
        selector: "#tour-mission-project",
        side: "bottom",
        showControls: true,
        pointerPadding: 10,
        pointerRadius: 12,
      },
      {
        icon: "📸",
        title: "Capture + submit feedback",
        content: <>A screenshot is required for every submission — proof you actually visited. Pair it with specific, actionable written feedback.</>,
        selector: "#tour-mission-submit-form",
        side: "top",
        showControls: true,
        pointerPadding: 10,
        pointerRadius: 12,
      },
    ],
  },
  {
    tour: "my-missions",
    steps: [
      {
        icon: "🎯",
        title: "All missions across your projects",
        content: <>Every mission you've added to your own projects lives here, in one place. Use this view to manage what testers are working on across everything you've shipped.</>,
        selector: "#tour-my-missions-header",
        side: "bottom",
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 8,
      },
    ],
  },
  {
    tour: "feedback-received",
    steps: [
      {
        icon: "💬",
        title: "All your incoming feedback",
        content: <>Every piece of feedback testers have left on your projects, gathered into one place. Read, learn, and ship better.</>,
        selector: "#tour-feedback-header",
        side: "bottom",
        showControls: true,
        pointerPadding: 8,
        pointerRadius: 8,
      },
    ],
  },
]

// Some targets live in the desktop nav (md+) and are display:none on mobile,
// where an equivalent element exists under a different id. On mobile we retarget
// the step to its mobile counterpart so the spotlight lands on a visible element.
const MOBILE_SELECTOR_OVERRIDES: Record<string, string> = {
  "#tour-new-project-btn": "#tour-new-project-btn-mobile",
}

// Return the tour set adjusted for the current viewport. On mobile we swap any
// desktop-only selectors for their mobile equivalents.
export function getTours(isMobile: boolean): Tour[] {
  if (!isMobile) return TOURS

  return TOURS.map((tour) => ({
    ...tour,
    steps: tour.steps.map((step) => {
      const override = MOBILE_SELECTOR_OVERRIDES[step.selector]
      return override ? { ...step, selector: override } : step
    }),
  }))
}

// Map a pathname to a tour name. Returns null if the page has no tour.
export function tourForPath(pathname: string): string | null {
  if (pathname === "/explore") return "explore"
  if (pathname === "/dashboard") return "my-projects"
  if (pathname === "/dashboard/new") return "new-project"
  if (pathname === "/explore/missions") return "browse-missions"
  if (pathname.startsWith("/explore/project/")) return "project-missions"
  if (pathname.startsWith("/mission/")) return "mission-submission"
  if (pathname === "/dashboard/missions") return "my-missions"
  if (pathname === "/dashboard/feedback") return "feedback-received"
  return null
}
