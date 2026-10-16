import { Search } from "lucide-react"
import { inputClass } from "@/components/ui/Field"
import { cn } from "@/lib/utils"

/**
 * The tester pages' search box, on the shared field chrome: 48px below lg,
 * 16px on touch so iOS does not zoom, and a real accessible name. From lg it
 * is 36px, as the bar-height search it replaced. cn() rather than appending:
 * twMerge drops inputClass's lg:h-10 for lg:h-9 instead of leaving two
 * heights for the stylesheet to pick between.
 */
export function SearchField({
  label,
  placeholder,
  value,
  onChange,
  className,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  /** Width and spacing — the caller's. */
  className?: string
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden="true"
        className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
      />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        enterKeyHint="search"
        autoCapitalize="none"
        spellCheck={false}
        className={cn(inputClass(false, { raised: true }), "lg:h-9 pl-9")}
      />
    </div>
  )
}
