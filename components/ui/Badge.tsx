import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "status-open" | "status-closed" | "role-tester" | "default"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2 h-6 font-mono text-xs uppercase font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "bg-[#1A2E1A] text-[#4ADE80] border border-[#166534]": variant === "status-open",
          "bg-[#2A2A35] text-[#8A8A99] border border-transparent": variant === "status-closed",
          "bg-voltage/10 text-voltage border border-voltage/20": variant === "role-tester",
          "bg-iron text-chalk border border-transparent": variant === "default",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
