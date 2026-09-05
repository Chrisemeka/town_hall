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
          "flex min-h-[80px] w-full rounded-md border border-iron bg-transparent px-3 py-2 text-sm text-chalk font-mono ring-offset-obsidian placeholder:text-ash focus-visible:outline-none focus-visible:border-voltage disabled:cursor-not-allowed disabled:opacity-50 resize-y",
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
