import React, { useEffect, useRef, useState } from 'react'
import {
  compressHeadshot,
  passportToPdf,
  HEADSHOT_MAX_BYTES,
  PASSPORT_MAX_BYTES,
  UnsupportedFileError,
  type ProcessResult,
} from '../../lib/evisa/processImage'

type Mode = 'headshot' | 'passport'

interface ModeConfig {
  title: string
  blurb: string
  limitBytes: number
  limitLabel: string
  process: (file: File) => Promise<ProcessResult>
}

const CONFIG: Record<Mode, ModeConfig> = {
  headshot: {
    title: 'Headshot → JPEG under 1MB',
    blurb: 'Upload your photo and we’ll shrink it to a JPEG that meets the e-Visa size limit.',
    limitBytes: HEADSHOT_MAX_BYTES,
    limitLabel: '1MB',
    process: compressHeadshot,
  },
  passport: {
    title: 'Passport photo → PDF under 300KB',
    blurb: 'Upload a clear photo or scan of your passport’s photo page and we’ll turn it into a PDF under the size limit.',
    limitBytes: PASSPORT_MAX_BYTES,
    limitLabel: '300KB',
    process: passportToPdf,
  },
}

type Status = 'idle' | 'processing' | 'done' | 'error'

interface Done {
  url: string
  name: string
  size: number
  originalSize: number
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

const FileShrinker: React.FC<{ mode: Mode }> = ({ mode }) => {
  const config = CONFIG[mode]
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<Done | null>(null)
  const [error, setError] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<string | null>(null)

  // Revoke the previous download URL whenever it changes or on unmount.
  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  function setDownload(done: Done | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = done?.url ?? null
    setResult(done)
  }

  async function handleFile(file: File) {
    setStatus('processing')
    setError('')
    setDownload(null)
    try {
      const out = await config.process(file)
      setDownload({ url: URL.createObjectURL(out.blob), name: out.name, size: out.size, originalSize: file.size })
      setStatus('done')
    } catch (err) {
      const message =
        err instanceof UnsupportedFileError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Something went wrong. Please try a different file.'
      setError(message)
      setStatus('error')
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const meetsLimit = result ? result.size <= config.limitBytes : false

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gold/40 bg-peach/30 p-4">
      <div className="flex-1">
        <h3 className="font-display text-lg text-rosewood">{config.title}</h3>
        <p className="mt-1 text-sm text-zeus/80">{config.blurb}</p>
      </div>

      <label className="btn-primary cursor-pointer self-start">
        {status === 'processing' ? 'Processing…' : result ? 'Choose a different file' : 'Choose a file'}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="sr-only"
          disabled={status === 'processing'}
          onChange={onChange}
        />
      </label>

      {status === 'processing' && (
        <p className="text-sm text-zeus/70" aria-live="polite">
          Working on it… large phone photos can take a few seconds.
        </p>
      )}

      {status === 'error' && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {status === 'done' && result && (
        <div className="flex flex-col gap-3" aria-live="polite">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-zeus/70">Original</dt>
            <dd className="text-right">{formatBytes(result.originalSize)}</dd>
            <dt className="text-zeus/70">Result</dt>
            <dd className="text-right font-medium">{formatBytes(result.size)}</dd>
          </dl>
          <p className={meetsLimit ? 'text-sm font-medium text-fern' : 'text-sm font-medium text-red-700'}>
            {meetsLimit
              ? `✓ Under the ${config.limitLabel} limit`
              : `Still over ${config.limitLabel} — try a tighter crop or a smaller original.`}
          </p>
          <a href={result.url} download={result.name} className="btn-primary self-start">
            Download {result.name}
          </a>
        </div>
      )}
    </div>
  )
}

export default FileShrinker
