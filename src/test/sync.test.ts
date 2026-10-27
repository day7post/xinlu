import { describe, expect, it, vi } from 'vitest'
import { decideSync, loadSyncConfig, saveSyncConfig } from '../lib/sync'
import { joinUrl, parseContentLength, parseEtag, parseLastModified } from '../lib/webdav'

describe('同步决策', () => {
  it('远程不存在时首次推送', () => {
    expect(decideSync({ remoteExists: false, remoteChanged: false, localDirty: true })).toBe('push-first')
    expect(decideSync({ remoteExists: false, remoteChanged: false, localDirty: false })).toBe('push-first')
  })

  it('只有一侧变化时单向同步', () => {
    expect(decideSync({ remoteExists: true, remoteChanged: true, localDirty: false })).toBe('pull')
    expect(decideSync({ remoteExists: true, remoteChanged: false, localDirty: true })).toBe('push')
  })

  it('两侧都变则冲突，都没变则最新', () => {
    expect(decideSync({ remoteExists: true, remoteChanged: true, localDirty: true })).toBe('conflict')
    expect(decideSync({ remoteExists: true, remoteChanged: false, localDirty: false })).toBe('up-to-date')
  })
})

describe('同步设置', () => {
  it('不记住密码时不落盘应用密码', () => {
    saveSyncConfig({
      providerKind: 'webdav',
      workerUrl: '',
      server: 'https://example.com/dav/',
      username: 'a@b.c',
      dir: 'xinlu',
      rememberPassword: false,
      appPassword: 'secret',
    })
    const loaded = loadSyncConfig()
    expect(loaded.username).toBe('a@b.c')
    expect(loaded.appPassword).toBeUndefined()
  })

  it('记住密码时可读回', () => {
    saveSyncConfig({
      providerKind: 'webdav',
      workerUrl: '',
      server: 'https://example.com/dav/',
      username: 'a@b.c',
      dir: 'xinlu',
      rememberPassword: true,
      appPassword: 'secret',
    })
    expect(loadSyncConfig().appPassword).toBe('secret')
  })
})

describe('WebDAV 工具', () => {
  it('拼接地址并编码路径', () => {
    expect(joinUrl('https://dav.example.com/dav/', 'xinlu', 'vault.xinlu')).toBe(
      'https://dav.example.com/dav/xinlu/vault.xinlu',
    )
    expect(joinUrl('https://dav.example.com/dav', '/a b/', 'c')).toBe('https://dav.example.com/dav/a%20b/c')
  })

  it('解析 PROPFIND 响应', () => {
    const xml =
      '<d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:prop>' +
      '<d:getetag>"abc123"</d:getetag><d:getcontentlength>2048</d:getcontentlength>' +
      '<d:getlastmodified>Mon, 27 Oct 2026 12:00:00 GMT</d:getlastmodified>' +
      '</d:prop></d:propstat></d:response></d:multistatus>'
    expect(parseEtag(xml)).toBe('"abc123"')
    expect(parseContentLength(xml)).toBe(2048)
    expect(parseLastModified(xml)).toContain('2026')
    expect(parseEtag('<d:multistatus/>')).toBeNull()
  })
})

import { CloudflareSyncProvider, deriveSyncToken } from '../lib/cloudflare'

describe('Cloudflare 同步提供方', () => {
  it('令牌由口令稳定派生', async () => {
    const first = await deriveSyncToken('correct horse battery')
    const second = await deriveSyncToken('correct horse battery')
    const other = await deriveSyncToken('another passphrase')
    expect(first).toBe(second)
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(other).not.toBe(first)
  })

  it('head 读取版本元数据，404 视为无数据', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith('/sync/meta')) {
        return new Response(JSON.stringify({ version: 3, updatedAt: '2026-10-27T00:00:00.000Z', size: 128 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ETag: '"v3"' },
        })
      }
      return new Response('{}', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const provider = new CloudflareSyncProvider({ workerUrl: 'https://sync.example.workers.dev/', token: 't'.repeat(64) })
    const info = await provider.head('vault.xinlu')
    expect(info?.etag).toBe('"v3"')
    expect(info?.size).toBe(128)

    const emptyMock = vi.fn(async () => new Response(JSON.stringify({ exists: false }), { status: 404 }))
    vi.stubGlobal('fetch', emptyMock)
    expect(await provider.head('vault.xinlu')).toBeNull()
    vi.unstubAllGlobals()
  })
})
