import Image from "next/image";

// Shared brand mark. The source asset (`/logo/android-chrome-192x192.png`) is
// dark line-art on a transparent background, so it reads well on light surfaces
// as-is and disappears on dark ones.
//
// Two ways to handle that, because there are two kinds of surface:
//
//   onDark        — for a STATICALLY dark surface (the dashboard, admin, the
//                   app nav). Flips to solid white via a CSS filter:
//                   brightness-0 forces solid black, invert then makes it white.
//
//   the default   — for a THEMED surface (the `(public)` group). The same
//                   markup renders on a light ground and a dark one, so no
//                   caller can know which it is. The `th-logo` class lets the
//                   flip follow `[data-theme]` in CSS instead — see
//                   app/globals.css. On an unthemed light surface the rule
//                   never matches and the asset is used as-is.
//
// They are mutually exclusive on purpose: a logo that is already inverted by
// `onDark` must not be inverted a second time by the theme.
export function Logo({
  size = 20,
  onDark = false,
  className = "",
}: {
  size?: number;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <Image
      src="/logo/android-chrome-192x192.png"
      alt="Twnhall logo"
      width={size}
      height={size}
      priority
      className={`${onDark ? "brightness-0 invert" : "th-logo"} ${className}`.trim()}
    />
  );
}
