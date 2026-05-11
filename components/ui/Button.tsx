import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive"
  size?: "default" | "sm" | "lg" | "xl" | "icon"
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        ref={ref}
        className={cn(
          // Base
          "inline-flex items-center justify-center rounded-[8px] font-mono font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-voltage focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian disabled:pointer-events-none disabled:opacity-40",
          // Variants
          variant === "primary"     && "bg-voltage text-obsidian hover:bg-voltage-dark",
          variant === "secondary"   && "bg-transparent border border-iron text-chalk hover:bg-graphite",
          variant === "ghost"       && "bg-transparent text-chalk border border-iron hover:border-voltage hover:text-voltage",
          variant === "destructive" && "bg-transparent border border-ember text-ember hover:bg-ember hover:text-obsidian",
          // Sizes
          size === "default" && "h-10 px-4 text-[14px]",
          size === "sm"      && "h-8  px-3 text-[12px]",
          size === "lg"      && "h-12 px-6 text-[14px]",
          size === "xl"      && "h-14 px-8 text-[16px]",
          size === "icon"    && "h-10 w-10",
          className,
        )}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button }
