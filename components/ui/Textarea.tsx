import * as React from "react"
import { cn } from "@/lib/utils"

// Alias rather than an empty extending interface, which is the same type with
// an extra hop. Kept exported so a consumer can name the props.
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm text-ink font-mono ring-offset-surface placeholder:text-ink-muted focus-visible:outline-none focus-visible:border-accent-ink disabled:cursor-not-allowed disabled:opacity-50 resize-y",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
