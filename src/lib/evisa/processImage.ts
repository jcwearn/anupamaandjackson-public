// Client-side image/PDF processing for the e-Visa upload requirements.
//
// The Indian e-Visa portal requires a headshot as a JPEG under 1MB and the
// passport bio page as a PDF under 300KB. Everything here runs in the browser
// so guests' documents never leave their device. Output filenames are fixed
// (headshot.jpg / passport.pdf) because the portal's upload form rejects
// filenames with certain characters. The heavy libraries are
// imported dynamically inside each function: they reference browser globals at
// module init, and this file is loaded transitively during the static
// prerender step, where those globals don't exist.

export const HEADSHOT_MAX_BYTES = 1024 * 1024 // 1MB
export const PASSPORT_MAX_BYTES = 300 * 1024 // 300KB

export interface ProcessResult {
  blob: Blob
  name: string
  size: number
}

export class UnsupportedFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedFileError'
  }
}

function isHeic(file: File): boolean {
  const type = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  )
}

function isImage(file: File): boolean {
  return file.type.startsWith('image/') || isHeic(file)
}

function baseName(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

// iPhones often produce HEIC, which most browsers can't decode on a canvas.
// Convert to JPEG first so the compression step has something it can read.
async function normalizeToJpeg(file: File): Promise<File> {
  if (!isHeic(file)) return file
  const { default: heic2any } = await import('heic2any')
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
  const blob = Array.isArray(converted) ? converted[0] : converted
  return new File([blob], baseName(file.name) + '.jpg', { type: 'image/jpeg' })
}

async function compressToJpeg(
  file: File,
  maxSizeMB: number,
  maxWidthOrHeight: number
): Promise<File> {
  const { default: imageCompression } = await import('browser-image-compression')
  return imageCompression(file, {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.9,
  })
}

function readDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read the image. Please try a different file.'))
    }
    img.src = url
  })
}

function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read the image. Please try a different file.'))
    reader.readAsDataURL(blob)
  })
}

// Shrink a headshot to a JPEG comfortably under 1MB. browser-image-compression
// also corrects EXIF orientation so the photo isn't sideways.
export async function compressHeadshot(file: File): Promise<ProcessResult> {
  if (!isImage(file)) {
    throw new UnsupportedFileError('Please upload an image file (JPG, PNG, or HEIC).')
  }
  const source = await normalizeToJpeg(file)
  const compressed = await compressToJpeg(source, 0.95, 1500)
  return { blob: compressed, name: 'headshot.jpg', size: compressed.size }
}

// Embed a single image (a photo or scan of the passport bio page) into a
// one-page PDF under 300KB. The PDF size is dominated by the embedded JPEG, so
// we compress to a margin below the limit and retry at smaller targets if the
// assembled PDF still comes out too large.
export async function passportToPdf(file: File): Promise<ProcessResult> {
  if (!isImage(file)) {
    throw new UnsupportedFileError('Please upload an image of your passport (JPG, PNG, or HEIC).')
  }
  const source = await normalizeToJpeg(file)
  const { jsPDF } = await import('jspdf')

  const targets = [0.27, 0.22, 0.18, 0.14, 0.1]
  let result: Blob | null = null

  for (const target of targets) {
    const compressed = await compressToJpeg(source, target, 1654)
    const [dataUrl, { width, height }] = await Promise.all([
      readDataUrl(compressed),
      readDimensions(compressed),
    ])

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 24
    const scale = Math.min((pageW - margin * 2) / width, (pageH - margin * 2) / height)
    const w = width * scale
    const h = height * scale
    doc.addImage(dataUrl, 'JPEG', (pageW - w) / 2, (pageH - h) / 2, w, h)

    result = doc.output('blob')
    if (result.size <= PASSPORT_MAX_BYTES) break
  }

  return { blob: result!, name: 'passport.pdf', size: result!.size }
}
