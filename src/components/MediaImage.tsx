import { useEffect, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { getStoredMedia } from '../lib/db'

const mediaUrlCache = new Map<string, string>()

export function MediaImage({
  mediaId,
  alt,
  className,
  useOriginal = false,
}: {
  mediaId: string
  alt: string
  className?: string
  useOriginal?: boolean
}) {
  const cacheKey = `${mediaId}:${useOriginal ? 'original' : 'thumb'}`
  const [source, setSource] = useState<string | null>(() => mediaUrlCache.get(cacheKey) ?? null)

  useEffect(() => {
    let cancelled = false
    const cached = mediaUrlCache.get(cacheKey)
    if (cached) return

    void getStoredMedia(mediaId).then((item) => {
      if (!item || cancelled) return
      const url = useOriginal ? URL.createObjectURL(item.blob) : item.record.thumbnailDataUrl
      mediaUrlCache.set(cacheKey, url)
      setSource(url)
    })
    return () => {
      cancelled = true
    }
  }, [cacheKey, mediaId, useOriginal])

  if (!source) {
    return (
      <span className={`${className ?? ''} media-placeholder`} aria-label="照片载入中">
        <ImageIcon size={20} />
      </span>
    )
  }

  return <img className={className} src={source} alt={alt} loading="lazy" />
}
