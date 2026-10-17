/**
 * Skeleton primitives for the route-level `loading.tsx` files.
 *
 * Design.md does not specify a skeleton treatment — §8 covers empty states,
 * which are a different thing: an empty state is a terminal answer ("Nothing
 * here yet"), a skeleton is a placeholder for content that is on its way. These
 * derive their look from the §5.3 card instead — raised surface, line border,
 * 12px radius — with tinted bars standing in for text at the real line heights,
 * so the skeleton and the content it replaces occupy the same space.
 *
 * Skeletons are decorative by definition. The tree is `aria-hidden` at each call
 * site and the route announces itself once through `LoadingAnnounce`, so a
 * screen reader gets one sentence rather than a bag of empty boxes.
 */

/**
 * A single placeholder line. Caller sets the height and width.
 *
 * A tint of the ink rather than a fixed colour: a skeleton has to read as
 * "slightly darker/lighter than the card" on whichever ground it lands on, and
 * an absolute value only does that on one of them.
 */
export function Bar({ className }: { className: string }) {
  return <div className={`bg-ink/[0.08] rounded-[4px] ${className}`} />
}

/**
 * The project card shared by /dashboard and /explore — both render the same
 * shape into the same `grid-cols-1 md:grid-cols-2 gap-6`.
 */
export function ProjectCardSkeleton() {
  return (
    <div className="bg-surface-raised border border-line rounded-[12px] p-6 flex flex-col gap-4">
      {/* Title + status badge */}
      <div className="flex items-start justify-between gap-4">
        <Bar className="h-7 w-1/2" />
        <Bar className="h-5 w-20" />
      </div>
      {/* Description, two lines */}
      <div className="flex flex-col gap-2">
        <Bar className="h-5 w-full" />
        <Bar className="h-5 w-4/5" />
      </div>
      {/* URL */}
      <Bar className="h-4 w-2/5" />
      {/* Footer counts + action */}
      <div className="pt-4 border-t border-line flex items-center justify-between gap-4">
        <Bar className="h-4 w-32" />
        <Bar className="h-4 w-16" />
      </div>
    </div>
  )
}

/*
 * The shapes below are shared by two or more loading.tsx files; a shape one
 * page alone needs stays in that page's file. Each copies the classes of the
 * thing it stands in for — read the component named in its comment before
 * changing either, or the page jumps when it paints.
 */

/** A revamped page header: the h1 role (28/36, 32/40, 36/44) and its subline.
 *  `action` adds the header button — full width under the text below 600px,
 *  beside it from 600px (My Missions). */
export function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div
      className={
        action
          ? "flex flex-col gap-4 medium:flex-row medium:items-start medium:justify-between mb-6 medium:mb-8"
          : "mb-6 medium:mb-8"
      }
    >
      <div className="flex flex-col gap-1">
        <Bar className="h-9 medium:h-10 expanded:h-11 w-56 max-w-full" />
        <Bar className="h-5 w-64 max-w-full" />
      </div>
      {action && <Bar className="h-12 lg:h-10 w-full medium:w-36 medium:mt-1 rounded-[8px] shrink-0" />}
    </div>
  )
}

/**
 * A page's breadcrumb. Revamped pages: a 48px back link below 600px, the
 * trail from 600px. `compactBack={false}` is the unrevamped pages' trail at
 * every width — copied as the page is, not fixed here.
 */
export function BreadcrumbSkeleton({ compactBack = true }: { compactBack?: boolean }) {
  const trail = (
    <div className="flex items-center gap-2 h-5">
      <Bar className="h-4 w-24" />
      <Bar className="h-4 w-32" />
    </div>
  )
  return compactBack ? (
    <>
      <div className="medium:hidden h-12 mb-4 flex items-center">
        <Bar className="h-4 w-32" />
      </div>
      <div className="hidden medium:block mb-8">{trail}</div>
    </>
  ) : (
    <div className="mb-8">{trail}</div>
  )
}

/** The row card My Missions, a project's Missions tab and Browse Missions all
 *  render: `meta` is the small line above the title (project, or number and
 *  date), `chips` the category and device chips under it. */
export function ListRowSkeleton({ meta = true, chips = false }: { meta?: boolean; chips?: boolean }) {
  return (
    <div className="bg-surface-raised border border-line rounded-[12px] px-4 py-4 medium:px-6 medium:py-5 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        {meta && <Bar className="h-4 w-28" />}
        <Bar className="h-6 w-2/3" />
        {chips && (
          <div className="flex items-center gap-2">
            <Bar className="h-6 w-20" />
            <Bar className="h-6 w-24" />
          </div>
        )}
      </div>
      <Bar className="hidden medium:block h-6 w-20 shrink-0" />
    </div>
  )
}

/** A label and its control, at the control's real height: `inputClass` is
 *  48px below lg and 40px from it; `tall` is a textarea. */
export function FormFieldSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <Bar className="h-4 w-24" />
      <Bar className={`${tall ? "h-32" : "h-12 lg:h-10"} w-full rounded-[8px]`} />
    </div>
  )
}

/** A test-case step as TestCaseView draws it: number, then action and
 *  expected result, each under its label. */
export function StepCardSkeleton() {
  return (
    <div className="bg-surface border border-line rounded-[12px] p-4 flex gap-4">
      <Bar className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <Bar className="h-3 w-16" />
        <Bar className="h-5 w-3/4" />
        <Bar className="h-3 w-24 mt-1" />
        <Bar className="h-5 w-1/2" />
      </div>
    </div>
  )
}

/** The form card's frame. The revamped forms drop it below 600px; the two
 *  unrevamped edit forms are carded at every width. */
const FORM_FRAME = {
  medium: "medium:bg-surface-raised medium:border medium:border-line medium:rounded-[16px] medium:p-10",
  always: "bg-surface-raised border border-line rounded-[16px] p-10",
}

function FormTitleSkeleton({ subline }: { subline: boolean }) {
  return subline ? (
    <div className="flex flex-col gap-1 mb-8">
      <Bar className="h-9 medium:h-10 lg:h-11 w-56 max-w-full" />
      <Bar className="h-6 w-72 max-w-full" />
    </div>
  ) : (
    <Bar className="h-11 w-56 max-w-full mb-8" />
  )
}

/** CreateProjectForm and EditProjectForm: name, URL, category, the summary
 *  textarea, then the actions. The edit form has no subline. */
export function ProjectFormSkeleton({ framed }: { framed: keyof typeof FORM_FRAME }) {
  return (
    <div className={FORM_FRAME[framed]}>
      <FormTitleSkeleton subline={framed === "medium"} />
      <div className="flex flex-col gap-5 medium:gap-6">
        <FormFieldSkeleton />
        <FormFieldSkeleton />
        <FormFieldSkeleton />
        <FormFieldSkeleton tall />
        <Bar className="h-12 w-full medium:w-40 rounded-[8px]" />
      </div>
    </div>
  )
}

/** AddMissionForm and EditMissionForm: the title field, then TestCaseEditor —
 *  the three category cards (stacked until lg) and the steps — and the
 *  actions. */
export function MissionFormSkeleton({ framed }: { framed: keyof typeof FORM_FRAME }) {
  return (
    <div className={FORM_FRAME[framed]}>
      <FormTitleSkeleton subline />
      <div className="flex flex-col gap-5 medium:gap-6">
        <FormFieldSkeleton />
        <div className="flex flex-col gap-3">
          <Bar className="h-4 w-32" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Bar key={i} className="h-24 w-full rounded-[12px]" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Bar className="h-4 w-24" />
          <StepCardSkeleton />
          <StepCardSkeleton />
        </div>
        <Bar className="h-12 w-full medium:w-40 rounded-[8px]" />
      </div>
    </div>
  )
}

/**
 * The one thing assistive tech is told while a route loads.
 *
 * Separate from the skeleton so the announcement says what is arriving rather
 * than describing the placeholder.
 */
export function LoadingAnnounce({ label }: { label: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {label}
    </span>
  )
}
