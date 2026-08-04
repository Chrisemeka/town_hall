// Browser-side image compression. Runs before upload so Storage holds a
// downscaled WebP instead of a 5 MB phone screenshot.
// ponytail: canvas re-encode, no dependency. Swap for a server-side sharp
// pipeline only if we ever need EXIF handling or true lossless output.

const MAX_DIMENSION = 1600
const WEBP_QUALITY = 0.8

export async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
    )
    // Re-encoding can grow an already-optimised file — keep whichever is smaller.
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp"
    return new File([blob], name, { type: "image/webp" })
  } catch {
    // Compression is best-effort — a failure must not block the submission.
    return file
  }
}
