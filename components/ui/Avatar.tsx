import { initials } from "@/lib/initials"
import { cn } from "@/lib/utils"

/**
 * A person's picture, or their initials when there isn't one.
 *
 * Shared so that "a null avatar_url renders initials" is true by construction
 * rather than by inspection of four call sites. That matters more than it used
 * to: `avatar_url` is Google's remote URL and nothing else — CLAUDE.md is
 * explicit that Twnhall stores no images and the `avatars` bucket does not
 * exist — so every email/password user has a null one.
 *
 * `referrerPolicy="no-referrer"` because the src is a Google URL and there is
 * no reason to tell them which page of ours is showing it.
 */
export function Avatar({
  src,
  name,
  email,
  size = 32,
  className,
}: {
  src?: string | null
  name?: string | null
  email?: string | null
  size?: number
  className?: string
}) {
  const label = name || email || "Unknown user"
  return (
    <div
      className={cn(
        "shrink-0 rounded-full bg-obsidian border border-iron overflow-hidden flex items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={label}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      ) : (
        <span
          className="font-mono text-ash leading-none"
          style={{ fontSize: Math.max(10, Math.round(size * 0.375)) }}
          // The initials are decoration on top of a name that is already in the
          // markup beside them; announcing "AT" as well is noise.
          aria-hidden="true"
        >
          {initials(name, email)}
        </span>
      )}
    </div>
  )
}
