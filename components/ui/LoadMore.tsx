/**
 * The paged lists' "Load More": 48px and full width below 600px, 40px from
 * lg. Bordered in ink-muted — `line` fails WCAG 1.4.11 as a control boundary.
 */
export function LoadMore({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-12 lg:h-10 w-full medium:w-auto px-6 border border-ink-muted text-ink rounded-[8px] font-mono text-[14px] hover:bg-surface-raised transition-colors duration-150"
    >
      Load More
    </button>
  )
}
