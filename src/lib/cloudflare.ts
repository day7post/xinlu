import type { RemoteFileInfo, SyncProvider } from './sync'
import { SyncError } from './webdav'

/** The sync token is derived from the passphrase, so there is no separate credential to manage. */
export async function deriveSyncToken(passphrase: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`xinlu-sync-v1:${passphrase}`),
  )
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

interface VaultMeta {
  version: number
  updatedAt: string
  size: number
}

export class CloudflareSyncProvider implements SyncProvider {
  private base: string
  private token: string

  constructor(options: { workerUrl: string; token: string }) {
    this.base = options.workerUrl.replace(/\/+$/, '')
    this.token = options.token
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    let response: Response
    try {
      response = await fetch(`${this.base}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${this.token}`, ...(init.headers ?? {}) },
      })
    } catch {
      throw new SyncError(
        'network',
        '连不上你的 Cloudflare 同步服务。请确认 Worker 地址正确，且当前网络能打开 workers.dev。',
      )
    }
    if (response.status === 401) {
      throw new SyncError('auth', '同步令牌被拒绝。请确认这台设备与另一台用的是同一个同步口令。')
    }
    return response
  }

  async testConnection(): Promise<void> {
    let response: Response
    try {
      response = await fetch(`${this.base}/`)
    } catch {
      throw new SyncError('network', '连不上 Worker 地址。请确认地址正确，且当前网络能打开 workers.dev。')
    }
    if (!response.ok) throw new SyncError('server', `Worker 返回 ${response.status}，服务未就绪。`)
    const body = (await response.json().catch(() => null)) as { ok?: boolean } | null
    if (!body?.ok) throw new SyncError('server', '这个地址能打开，但不是心络同步服务，请确认填的是 xinlu-sync 的地址。')
  }

  async ensureDir(): Promise<void> {
    // KV namespaces are provisioned with the Worker; nothing to create here.
  }

  async head(): Promise<RemoteFileInfo | null> {
    const response = await this.request('/sync/meta')
    if (response.status === 404) return null
    if (!response.ok) throw new SyncError('server', `读取远程状态失败（${response.status}）。`)
    const meta = (await response.json()) as VaultMeta
    return {
      etag: response.headers.get('etag') ?? `"v${meta.version}"`,
      size: meta.size,
      modified: meta.updatedAt,
    }
  }

  async get(): Promise<{ blob: Blob; etag: string | null }> {
    const response = await this.request('/sync/vault')
    if (response.status === 404) throw new SyncError('not-found', '云端还没有数据。')
    if (!response.ok) throw new SyncError('server', `下载失败（${response.status}）。`)
    return { blob: await response.blob(), etag: response.headers.get('etag') }
  }

  async put(_path: string, blob: Blob): Promise<{ etag: string | null }> {
    const response = await this.request('/sync/vault', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: blob,
    })
    if (!response.ok) throw new SyncError('server', `上传失败（${response.status}）。`)
    const meta = (await response.json().catch(() => null)) as VaultMeta | null
    return { etag: response.headers.get('etag') ?? (meta ? `"v${meta.version}"` : null) }
  }
}
