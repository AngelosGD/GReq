export interface PostmanEndpoint {
  method: string
  path: string
  summary: string
  baseUrl?: string
  headers: { name: string; value: string }[]
  body?: string
  contentType?: string
}

interface PostmanCollection {
  info?: { name?: string }
  item: PostmanItem[]
}

interface PostmanItem {
  name?: string
  request?: PostmanRequest
  item?: PostmanItem[]
  response?: PostmanResponse[]
}

interface PostmanRequest {
  method?: string
  header?: { key: string; value: string }[]
  url?: PostmanUrl | string
  body?: { mode?: string; raw?: string; formdata?: { key: string; value: string }[] }
}

interface PostmanUrl {
  raw?: string
  protocol?: string
  host?: string | string[]
  path?: (string | { type?: string; value?: string })[]
  query?: { key: string; value: string }[]
  variable?: { key: string; value: string }[]
}

interface PostmanResponse {
  name?: string
  status?: string
  code?: number
  header?: { key: string; value: string }[]
  body?: string
}

function flattenItems(items: PostmanItem[]): { name: string; request: PostmanRequest }[] {
  const result: { name: string; request: PostmanRequest }[] = []
  for (const item of items) {
    if (item.request) {
      result.push({ name: item.name || '', request: item.request })
    }
    if (item.item) {
      result.push(...flattenItems(item.item))
    }
  }
  return result
}

function parseUrl(url: PostmanUrl | string): { baseUrl: string; path: string; host: string } {
  if (typeof url === 'string') {
    try {
      const parsed = new URL(url)
      return { baseUrl: `${parsed.protocol}//${parsed.host}`, path: parsed.pathname.replace(/^\//, ''), host: parsed.host }
    } catch {
      return { baseUrl: '', path: url.replace(/^\//, ''), host: '' }
    }
  }

  const protocol = url.protocol || 'https'
  let host = ''
  if (typeof url.host === 'string') {
    host = url.host
  } else if (Array.isArray(url.host)) {
    host = url.host.join('.')
  }

  const pathParts = (url.path || []).map((p) => (typeof p === 'string' ? p : p.value || ''))
  const path = pathParts.join('/')

  const queryStr = (url.query || []).map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`).join('&')
  const fullPath = path + (queryStr ? `?${queryStr}` : '')

  return { baseUrl: `${protocol}://${host}`, path: fullPath, host }
}

function parseBody(body: PostmanRequest['body']): { body: string; contentType: string } | null {
  if (!body) return null
  if (body.mode === 'raw' && body.raw) return { body: body.raw, contentType: 'application/json' }
  if (body.mode === 'formdata' && body.formdata) {
    const obj: Record<string, string> = {}
    for (const f of body.formdata) obj[f.key] = f.value
    return { body: JSON.stringify(obj, null, 2), contentType: 'application/json' }
  }
  return null
}

export function parsePostmanCollection(text: string): PostmanEndpoint[] {
  let collection: PostmanCollection
  try {
    collection = JSON.parse(text)
  } catch {
    throw new Error('JSON inválido')
  }

  if (!collection.item) throw new Error('No se encontraron items en la colección')

  const items = flattenItems(collection.item)
  if (items.length === 0) throw new Error('No se encontraron endpoints en la colección')

  return items.map((item) => {
    const req = item.request
    const method = (req.method || 'GET').toUpperCase()
    const { baseUrl, path } = parseUrl(req.url || '')
    const parsedBody = parseBody(req.body)
    const headers = (req.header || []).map((h) => ({ name: h.key, value: h.value }))

    return {
      method,
      path,
      summary: item.name || `${method} ${path}`,
      baseUrl: baseUrl || undefined,
      headers,
      body: parsedBody?.body,
      contentType: parsedBody?.contentType,
    }
  })
}
