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

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('缩略图生成失败'))
    }, 'image/webp', 0.82)
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
}

export async function prepareMediaFile(file: File): Promise<PreparedMedia | null> {
  if (!file.type.startsWith('image/')) return null
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const maxSide = 640
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * ratio))
    const height = Math.max(1, Math.round(image.naturalHeight * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法生成缩略图')
    context.drawImage(image, 0, 0, width, height)
    const thumbnail = await canvasToBlob(canvas)
    const thumbnailDataUrl = await blobToDataUrl(thumbnail)
    const record: MediaRecord = {
      id: createId('media'),
      name: file.name || '照片',
      mime: file.type,
      size: file.size,
      createdAt: new Date().toISOString(),
      thumbnailDataUrl,
      width: image.naturalWidth,
      height: image.naturalHeight,
    }
    return { record, blob: file }
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
