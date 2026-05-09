import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "active" | "needs-testers" | "draft" | "complete" | "archived" | "role-tester" | "default"
}

const DOT_COLOR: Record<string, string> = {
  active:         "#3FFFA2",
  "needs-testers":"#E8FF47",
  draft:          "#8A8A99",
  complete:       "#3FFFA2",
  archived:       "#44444F",
  "role-tester":  "#E8FF47",
  default:        "#8A8A99",
}

const LABEL_COLOR: Record<string, string> = {
  active:         "#3FFFA2",
  "needs-testers":"#E8FF47",
  draft:          "#8A8A99",
  complete:       "#3FFFA2",
  archived:       "#44444F",
  "role-tester":  "#E8FF47",
  default:        "#8A8A99",
}

const LABEL_TEXT: Record<string, string> = {
  active:         "ACTIVE",
  "needs-testers":"NEEDS TESTERS",
  draft:          "DRAFT",
  complete:       "COMPLETE",
  archived:       "ARCHIVED",
  "role-tester":  "TESTER",
  default:        "",
}

function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const dot  = DOT_COLOR[variant]
  const color = LABEL_COLOR[variant]
  const label = children ?? LABEL_TEXT[variant]

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[4px] px-2 h-6 font-mono text-[12px] font-medium uppercase tracking-[0.5px] border border-iron",
        className,
      )}
      style={{ color }}
      {...props}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: dot }}
      />
      {label}
    </div>
  )
}

export { Badge }
