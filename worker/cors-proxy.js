// 心络 WebDAV 跨域代理（部署在你自己的 Cloudflare Worker 上）
// 用法：把本文件内容粘贴到 Cloudflare Worker 编辑器并部署，
// 然后在心络「跨端同步」的服务器地址里填：
//   https://<你的Worker地址>/dav
// 代理会把 /dav 之后的请求转发到坚果云 WebDAV，并补上浏览器需要的跨域响应头。
// 经过代理的只有密文（端到端加密），代理本身不保存任何内容。

const UPSTREAM = 'https://dav.jianguoyun.com'

export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/dav')) {
      return new Response('Not found', { status: 404 })
    }
    const target = UPSTREAM + url.pathname + url.search

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PUT, PROPFIND, MKCOL, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, Depth, If-Match',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    const hasBody = !['GET', 'HEAD'].includes(request.method)
    const upstream = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
    })

    const headers = new Headers(upstream.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Expose-Headers', 'ETag, Content-Length')
    return new Response(upstream.body, { status: upstream.status, headers })
  },
}
