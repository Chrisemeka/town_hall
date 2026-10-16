/*
 * An M3 segmented button below 600px — three joined 48px segments, the
 * selected one given `relative` so its whole border shows over its
 * neighbours — and separate 40px chips from 600px. The audit-log status
 * control and the homepage's preview of it both use these, so the mock
 * cannot drift from the form it shows.
 */
export const SEGMENTS = "grid grid-cols-3 medium:flex medium:flex-wrap medium:gap-2"
export const SEGMENT =
  "h-12 medium:h-10 px-4 inline-flex items-center justify-center border font-mono text-[13px] font-medium rounded-[8px] max-medium:rounded-none max-medium:-ml-px max-medium:first:ml-0 max-medium:first:rounded-l-[8px] max-medium:last:rounded-r-[8px]"
