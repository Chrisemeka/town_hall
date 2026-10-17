"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"

/*
 * The public pages' entrance (Design.md §9, "Page reveal"): a block fades in
 * and rises 8px the first time it enters the viewport — on load for what is
 * already on screen, on scroll for the rest. Soft and slow on purpose, after
 * Apple's: 600ms on the standard curve, siblings 100ms apart by `step`.
 *
 * Someone who asked for less motion gets the end state: the same props with
 * a zero-length transition, never different props. The server cannot know
 * the preference and renders every block at opacity 0; dropping the
 * animation on the client then leaves nothing to take it back to 1 — on
 * reduced motion, /pricing and /terms rendered blank below their nav.
 */
export const REVEAL = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.2, 0, 0, 1] as const },
  /** Seconds between siblings that enter together. */
  stagger: 0.1,
}

const TAGS = { div: motion.div, section: motion.section, article: motion.article }

export function Reveal({
  as = "div",
  step = 0,
  id,
  className,
  "aria-labelledby": labelledBy,
  children,
}: {
  as?: keyof typeof TAGS
  /** The block's place among siblings entering together: 0, 1, 2…
   *  An index rather than seconds, so server pages need no constant from
   *  this client module (it would reach them as a reference, not a number). */
  step?: number
  id?: string
  className?: string
  "aria-labelledby"?: string
  children: ReactNode
}) {
  const still = useReducedMotion()
  const Tag = TAGS[as]
  return (
    <Tag
      id={id}
      aria-labelledby={labelledBy}
      className={className}
      // Print shows everything, revealed or not (globals.css).
      data-reveal=""
      initial={REVEAL.hidden}
      whileInView={REVEAL.visible}
      // Once it has landed, never again; and only once it is a little way
      // in, so a block at the fold does not fire unseen.
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={still ? { duration: 0 } : { ...REVEAL.transition, delay: step * REVEAL.stagger }}
    >
      {children}
    </Tag>
  )
}
