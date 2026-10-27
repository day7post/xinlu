import { createId } from './id'
import type { MediaRecord } from '../types'

interface PreparedMedia {
  record: MediaRecord
  blob: Blob
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片读取失败'))
    image.src = url
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/webp',
  quality = 0.82,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

async function encodeCanvas(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const webp = await canvasToBlob(canvas, 'image/webp', quality)
  if (webp) return webp
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality)
  if (jpeg) return jpeg
  throw new Error('图片压缩失败')
}

function drawScaled(image: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器无法处理图片')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
}

const ORIGINAL_MAX_SIDE = 1920
const ORIGINAL_MAX_BYTES = 2 * 1024 * 1024

export async function prepareMediaFile(file: File): Promise<PreparedMedia | null> {
  if (!file.type.startsWith('image/')) return null
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const thumbnail = await encodeCanvas(drawScaled(image, 640), 0.82)
    const thumbnailDataUrl = await blobToDataUrl(thumbnail)

    const longestSide = Math.max(image.naturalWidth, image.naturalHeight)
    const needsCompression = longestSide > ORIGINAL_MAX_SIDE || file.size > ORIGINAL_MAX_BYTES
    let blob: Blob = file
    if (needsCompression) {
      const compressed = await encodeCanvas(drawScaled(image, ORIGINAL_MAX_SIDE), 0.85)
      if (compressed.size < file.size) blob = compressed
    }

    const record: MediaRecord = {
      id: createId('media'),
      name: file.name || '照片',
      mime: blob.type || file.type,
      size: blob.size,
      createdAt: new Date().toISOString(),
      thumbnailDataUrl,
      width: image.naturalWidth,
      height: image.naturalHeight,
    }
    return { record, blob }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mime })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
