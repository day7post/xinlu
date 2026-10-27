// 心络 Cloudflare 同步服务（部署在你自己的 Cloudflare 账号里）
// 存储使用 Cloudflare KV（绑定名必须是 VAULT_KV）。
// 客户端用同步口令派生出的令牌访问，密文按令牌哈希分键存储：
// Worker 只经手密文，看不到内容；不需要额外的账号或令牌管理。
//
// 接口：
//   GET  /            健康检查
//   GET  /sync/meta   返回 { version, updatedAt, size }，无数据时 404
//   GET  /sync/vault  下载密文，ETag 为 "v<version>"
//   PUT  /sync/vault  上传密文，版本号加一

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Expose-Headers': 'ETag',
  'Access-Control-Max-Age': '86400',
}

function withCors(response) {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value)
  return new Response(response.body, { status: response.status, headers })
}

function json(data, status = 200) {
  return withCors(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }
    const url = new URL(request.url)

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, service: 'xinlu-sync' })
    }
    if (!url.pathname.startsWith('/sync/')) {
      return json({ error: 'not found' }, 404)
    }
    if (!env.VAULT_KV) {
      return json({ error: 'KV binding VAULT_KV is missing' }, 500)
    }

    const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (token.length < 32) {
      return json({ error: 'missing or invalid token' }, 401)
    }
    const key = `vault:${await sha256Hex(token)}`
    const metaKey = `${key}:meta`

    if (request.method === 'GET' && url.pathname === '/sync/meta') {
      const meta = await env.VAULT_KV.get(metaKey, 'json')
      if (!meta) return json({ exists: false }, 404)
      return withCors(
        new Response(JSON.stringify(meta), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ETag: `"v${meta.version}"` },
        }),
      )
    }

    if (request.method === 'GET' && url.pathname === '/sync/vault') {
      const value = await env.VAULT_KV.get(key, 'arrayBuffer')
      if (!value) return json({ error: 'not found' }, 404)
      const meta = await env.VAULT_KV.get(metaKey, 'json')
      const headers = { 'Content-Type': 'application/octet-stream' }
      if (meta) headers.ETag = `"v${meta.version}"`
      return withCors(new Response(value, { status: 200, headers }))
    }

    if (request.method === 'PUT' && url.pathname === '/sync/vault') {
      const body = await request.arrayBuffer()
      const previous = await env.VAULT_KV.get(metaKey, 'json')
      const version = (previous?.version ?? 0) + 1
      const meta = { version, updatedAt: new Date().toISOString(), size: body.byteLength }
      await env.VAULT_KV.put(key, body)
      await env.VAULT_KV.put(metaKey, JSON.stringify(meta))
      return withCors(
        new Response(JSON.stringify(meta), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ETag: `"v${version}"` },
        }),
      )
    }

    return json({ error: 'not found' }, 404)
  },
}
