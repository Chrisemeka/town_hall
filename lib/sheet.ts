/** The close button is a 48px square, the same as the trigger it covers. */
export const CLOSE_SIZE = 48

/**
 * Where the sheet's close button goes: exactly on the trigger that opened it,
 * as `top` / `right` offsets inside the full-height, trailing-edge sheet.
 *
 * `viewportWidth` is `document.documentElement.clientWidth`, never
 * `innerWidth`: a fixed dialog's right edge is the left edge of a classic 17px
 * scrollbar, so `innerWidth` puts the X 17px too far left on Windows desktop.
 *
 * A trigger scrolled out of view (the public header goes `static` below 480px
 * of height) has no position worth matching, so the X centres in the band,
 * keeping the horizontal inset, which scrolling does not change.
 */
export function closeButtonPosition(
  trigger: { top: number; right: number; bottom: number },
  viewportWidth: number,
  sheetWidth: number,
  bandHeight: number,
): { top: number; right: number } {
  const top = trigger.bottom <= 0 ? (bandHeight - CLOSE_SIZE) / 2 : trigger.top
  const right = viewportWidth - trigger.right
  return {
    top: Math.max(0, top),
    right: Math.min(Math.max(0, right), Math.max(0, sheetWidth - CLOSE_SIZE)),
  }
}
