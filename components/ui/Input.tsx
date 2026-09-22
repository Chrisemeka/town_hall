import * as React from "react"
import { cn } from "@/lib/utils"

// Alias rather than an empty extending interface, which is the same type with
// an extra hop. Kept exported so a consumer can name the props.
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm text-ink font-mono ring-offset-surface file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-ink-muted focus-visible:outline-none focus-visible:border-accent-ink disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
