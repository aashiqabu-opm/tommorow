// Client-side image compression before upload.
// Photos from phones are often 3-8MB; this resizes them to max 1600px
// and re-encodes as JPEG (~100-300KB), extending Supabase storage ~10x.
// Non-images (PDFs) and already-small files pass through untouched.

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.75
const SKIP_BELOW_BYTES = 300 * 1024

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  if (file.size < SKIP_BELOW_BYTES) return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    )
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    // Unsupported format (e.g. some HEIC files) — upload the original
    return file
  }
}
