import Image from "next/image";

// Shared brand mark. The source asset (`/logo/android-chrome-192x192.png`) is
// dark line-art on a transparent background, so it reads well on light surfaces
// as-is. On dark surfaces pass `onDark` to flip it to solid white via a CSS
// filter (brightness-0 forces solid black, invert then makes it white).
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
      className={`${onDark ? "brightness-0 invert" : ""} ${className}`.trim()}
    />
  );
}
