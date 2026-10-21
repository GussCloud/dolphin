import { useEffect, useState } from 'react'

/**
 * Blob URL of the user's avatar image, or null for the bundled logo. Reloads whenever
 * `reloadKey` changes; main resolves the file, so the path never reaches this renderer.
 */
export function useAgentInteractionAvatarImage(reloadKey: string | number): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    let created: string | null = null
    void window.api.agentInteractionAvatar.loadImage().then((image) => {
      if (disposed) {
        return
      }
      if (!image.ok) {
        setUrl(null)
        return
      }
      const bytes = new Uint8Array(image.data.byteLength)
      bytes.set(image.data)
      created = URL.createObjectURL(new Blob([bytes.buffer], { type: image.mimeType }))
      setUrl(created)
    })
    return () => {
      disposed = true
      if (created) {
        URL.revokeObjectURL(created)
      }
    }
  }, [reloadKey])

  return url
}
