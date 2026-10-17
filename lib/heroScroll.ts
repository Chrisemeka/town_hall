/**
 * The homepage hero's scroll progress, 0 at rest to 1 when the rising window's
 * top edge reaches the pinned copy's top edge (SPEC-motion-hero-scroll §4).
 *
 * The hero is the first thing on the page, so rest is scrollY 0. The window
 * starts at the bottom of the copy's region and the copy is centred in it, so
 * the window covers the copy after (region + copy) / 2 of scrolling.
 */
export function heroProgress(scrollY: number, regionHeight: number, copyHeight: number): number {
  const span = (regionHeight + copyHeight) / 2
  if (span <= 0) return 0
  return Math.min(1, Math.max(0, scrollY / span))
}
