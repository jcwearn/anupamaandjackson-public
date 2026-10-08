/**
 * Hands a Blob to the browser as a download called `filename`.
 *
 * Shared by the PNG and spreadsheet exports, and the reason the spreadsheet one
 * does not use write-excel-file's own `toFile()`: that revokes the object URL
 * 100ms after the click, which is the same bug this was written around.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Not immediately: Safari has not started reading the blob when click()
  // returns, and revoking under it saves a zero-byte file.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
