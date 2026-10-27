import type { RemoteFileInfo, SyncProvider } from './sync'

export function joinUrl(base: string, ...parts: string[]): string {
  const cleanBase = base.replace(/\/+$/, '')
  const cleanParts = parts
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .map((part) => part.split('/').map(encodeURIComponent).join('/'))
  return [cleanBase, ...cleanParts].join('/')
}

export function parseEtag(xml: string): string | null {
  const match = xml.match(/<[^>]*getetag[^>]*>([^<]+)<\/[^>]*getetag>/i)
  return match ? match[1].trim() : null
}

export function parseContentLength(xml: string): number {
  const match = xml.match(/<[^>]*getcontentlength[^>]*>(\d+)<\/[^>]*getcontentlength>/i)
  return match ? Number(match[1]) : 0
}

export function parseLastModified(xml: string): string {
  const match = xml.match(/<[^>]*getlastmodified[^>]*>([^<]+)<\/[^>]*getlastmodified>/i)
  return match ? match[1].trim() : ''
}

function base64FromString(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export class SyncError extends Error {
  kind: 'auth' | 'network' | 'cors' | 'not-found' | 'server'

  constructor(kind: SyncError['kind'], message: string) {
    super(message)
    this.kind = kind
  }
}

function toSyncError(error: unknown): SyncError {
  if (error instanceof SyncError) return error
  if (error instanceof TypeError) {
    return new SyncError(
      'cors',
      '连接被浏览器拦截。这个 WebDAV 服务器没有开放跨域（CORS），网页无法直连；需要改用支持跨域的 WebDAV，或经你自己的代理地址访问。',
    )
  }
  return new SyncError('network', '网络连接失败，请检查地址与网络后重试。')
}

export class WebDavProvider implements SyncProvider {
  private server: string
  private dir: string
  private authHeader: string

  constructor(options: { server: string; username: string; appPassword: string; dir: string }) {
    this.server = options.server
    this.dir = options.dir
    this.authHeader = `Basic ${base64FromString(`${options.username}:${options.appPassword}`)}`
  }

  private fileUrl(path: string): string {
    return joinUrl(this.server, this.dir, path)
  }

  private dirUrl(): string {
    return joinUrl(this.server, this.dir)
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    let response: Response
    try {
      response = await fetch(url, {
        ...init,
        headers: { Authorization: this.authHeader, ...(init.headers ?? {}) },
      })
    } catch (error) {
      throw toSyncError(error)
    }
    if (response.status === 401 || response.status === 403) {
      throw new SyncError('auth', '账号或应用密码不正确。请确认使用的是 WebDAV 应用密码，而不是登录密码。')
    }
    return response
  }

  async testConnection(): Promise<void> {
    const response = await this.request(this.server, { method: 'PROPFIND', headers: { Depth: '0' } })
    if (!response.ok && response.status !== 207) {
      throw new SyncError('server', `服务器返回 ${response.status}，连接未成功。`)
    }
  }

  async ensureDir(): Promise<void> {
    const response = await this.request(this.dirUrl(), { method: 'MKCOL' })
    if (response.ok || response.status === 405 || response.status === 301) return
    if (response.status === 409) {
      throw new SyncError('server', '远程目录的父目录不存在，请先在网盘里建好上级目录，或换一个目录名。')
    }
    if (response.status === 404) return
    throw new SyncError('server', `创建远程目录失败（${response.status}）。`)
  }

  async head(path: string): Promise<RemoteFileInfo | null> {
    const response = await this.request(this.fileUrl(path), {
      method: 'PROPFIND',
      headers: { Depth: '0' },
    })
    if (response.status === 404) return null
    if (!response.ok && response.status !== 207) {
      throw new SyncError('server', `读取远程状态失败（${response.status}）。`)
    }
    const xml = await response.text()
    return {
      etag: parseEtag(xml) ?? response.headers.get('etag'),
      size: parseContentLength(xml),
      modified: parseLastModified(xml),
    }
  }

  async get(path: string): Promise<{ blob: Blob; etag: string | null }> {
    const response = await this.request(this.fileUrl(path), { method: 'GET' })
    if (response.status === 404) throw new SyncError('not-found', '远程文件不存在。')
    if (!response.ok) throw new SyncError('server', `下载失败（${response.status}）。`)
    return { blob: await response.blob(), etag: response.headers.get('etag') }
  }

  async put(path: string, blob: Blob): Promise<{ etag: string | null }> {
    const response = await this.request(this.fileUrl(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: blob,
    })
    if (!response.ok && response.status !== 201 && response.status !== 204) {
      throw new SyncError('server', `上传失败（${response.status}）。`)
    }
    return { etag: response.headers.get('etag') }
  }
}
