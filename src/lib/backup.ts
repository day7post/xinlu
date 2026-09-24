import type { BackupPayload, EncryptedBackup, VaultData } from '../types'
import type { StoredMedia } from './db'
import { blobToBase64 } from './media'

const BACKUP_ITERATIONS = 210_000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

async function deriveKey(passphrase: string, salt: ArrayBuffer, iterations = BACKUP_ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function createEncryptedBackup(
  vault: VaultData,
  media: StoredMedia[],
  passphrase: string,
): Promise<Blob> {
  const exportedAt = new Date().toISOString()
  const payload: BackupPayload = {
    format: 'xinlu-backup',
    version: 1,
    exportedAt,
    vault,
    media: await Promise.all(
      media.map(async (item) => ({
        record: item.record,
        originalBase64: await blobToBase64(item.blob),
      })),
    ),
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, toArrayBuffer(salt))
  const plaintext = new TextEncoder().encode(JSON.stringify(payload))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    plaintext,
  )
  const encrypted: EncryptedBackup = {
    format: 'xinlu-encrypted-backup',
    version: 1,
    exportedAt,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: BACKUP_ITERATIONS,
      salt: bytesToBase64(salt),
    },
    cipher: {
      name: 'AES-GCM',
      iv: bytesToBase64(iv),
    },
    data: bytesToBase64(new Uint8Array(ciphertext)),
  }
  return new Blob([JSON.stringify(encrypted)], { type: 'application/json' })
}

function validatePayload(value: unknown): value is BackupPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<BackupPayload>
  return Boolean(
    payload.format === 'xinlu-backup' &&
      payload.version === 1 &&
      payload.vault &&
      Array.isArray(payload.vault.anchors) &&
      Array.isArray(payload.vault.revisions) &&
      Array.isArray(payload.vault.heartlines) &&
      Array.isArray(payload.media),
  )
}

export async function decryptBackup(file: File, passphrase: string): Promise<BackupPayload> {
  let encrypted: EncryptedBackup
  try {
    encrypted = JSON.parse(await file.text()) as EncryptedBackup
  } catch {
    throw new Error('这个文件不是有效的心络备份。')
  }
  if (encrypted.format !== 'xinlu-encrypted-backup' || encrypted.version !== 1) {
    throw new Error('备份格式暂不受支持。')
  }

  const salt = base64ToBytes(encrypted.kdf.salt)
  const iv = base64ToBytes(encrypted.cipher.iv)
  const key = await deriveKey(passphrase, toArrayBuffer(salt), encrypted.kdf.iterations)
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(base64ToBytes(encrypted.data)),
    )
    const payload = JSON.parse(new TextDecoder().decode(plaintext)) as unknown
    if (!validatePayload(payload)) throw new Error('invalid payload')
    return payload
  } catch {
    throw new Error('口令不正确，或备份文件已经损坏。')
  }
}



