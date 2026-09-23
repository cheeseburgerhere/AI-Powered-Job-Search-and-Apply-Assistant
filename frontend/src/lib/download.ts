/** Filename from a Content-Disposition header, preferring the RFC 5987 UTF-8 form. */
function filenameFrom(header: string | null, fallback: string): string {
  if (!header) return fallback
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1])
    } catch {
      // Malformed encoding: fall through to the plain filename.
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i)
  return plain ? plain[1] : fallback
}

/** Fetch a file from the API and hand it to the browser as a download. */
export async function downloadFile(url: string, fallbackName: string, init?: RequestInit): Promise<void> {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`Download failed (${response.status})`)
  const blob = await response.blob()
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filenameFrom(response.headers.get('content-disposition'), fallbackName)
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
}
