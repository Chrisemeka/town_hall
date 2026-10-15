/**
 * A horizontal touch swipe: -1 back, 1 forward, 0 for anything that is not
 * clearly sideways, so a vertical scroll never counts. Swipe left (dx < 0)
 * moves forward. Direction only; the caller clamps or wraps. Used by the
 * homepage demo and the screenshot lightbox.
 */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < 48 || Math.abs(dx) <= 2 * Math.abs(dy)) return 0
  return dx < 0 ? 1 : -1
}
