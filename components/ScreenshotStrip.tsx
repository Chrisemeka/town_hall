// At-a-glance evidence indicator for feedback lists: the first few thumbnails
// plus a count, so builders can see evidence exists without opening the entry.
const PREVIEW_LIMIT = 3

export function ScreenshotStrip({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null

  return (
    <div className="flex items-center gap-2 mt-3">
      <div className="flex gap-1.5">
        {urls.slice(0, PREVIEW_LIMIT).map((url) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt=""
            className="w-8 h-8 rounded-[6px] object-cover border border-iron"
          />
        ))}
      </div>
      <span className="font-mono text-[12px] text-ash">
        {urls.length} screenshot{urls.length !== 1 ? "s" : ""}
      </span>
    </div>
  )
}
