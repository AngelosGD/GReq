import { simpleYamlParse } from './openapi'

export interface GitHubEndpointParam {
  name: string
  type: string
  required?: boolean
  in?: 'path' | 'query' | 'header'
}

export interface GitHubEndpoint {
  method: string
  path: string
  summary: string
  description?: string
  baseUrl?: string
  params?: GitHubEndpointParam[]
  headers?: { name: string; value: string }[]
  body?: string
  contentType?: string
}

export interface GitHubImportResult {
  title: string
  endpoints: GitHubEndpoint[]
  openapiUrl?: string
  baseUrl?: string
  cached?: boolean
  scanned?: boolean
}

// ── Cache (5 min TTL) ──
const CACHE_PREFIX = 'greq-github-cache-'
const CACHE_TTL = 5 * 60 * 1000

function hashStr(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h).toString(36)
}

function cacheKey(url: string): string {
  return CACHE_PREFIX + hashStr(url.toLowerCase().replace(/\.git$/, ''))
}

function loadCache(url: string): GitHubImportResult | null {
  try {
    const raw = localStorage.getItem(cacheKey(url))
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(cacheKey(url))
      return null
    }
    return { ...entry.result, cached: true }
  } catch {
    return null
  }
}

function saveCache(url: string, result: GitHubImportResult) {
  try {
    localStorage.setItem(cacheKey(url), JSON.stringify({ result, timestamp: Date.now() }))
  } catch { /* ignore */ }
}

function cleanGithubUrl(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/\s?#]+)/)
  if (!m) return null
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') }
}

// ── $ref resolution ──
function resolveRef(root: any, ref: string): any {
  if (!ref.startsWith('#/')) return undefined
  const parts = ref.slice(2).split('/').map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'))
  let current = root
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[part]
  }
  return current
}

// ── Sample body generation ──
function generateSample(schema: any, root: any, depth = 0): any {
  if (depth > 6) return null
  if (!schema || typeof schema !== 'object') return null
  if (schema.$ref) {
    const resolved = resolveRef(root, schema.$ref)
    if (resolved) return generateSample(resolved, root, depth + 1)
    return null
  }
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  if (schema.type === 'object' || schema.properties) {
    const result: any = {}
    for (const [key, val] of Object.entries(schema.properties || {})) {
      const v = val as any
      if (v.example !== undefined) result[key] = v.example
      else if (v.default !== undefined) result[key] = v.default
      else if (v.type === 'string' || !v.type) result[key] = key
      else if (v.type === 'integer' || v.type === 'number') result[key] = 1
      else if (v.type === 'boolean') result[key] = true
      else if (v.type === 'object' || v.properties) {
        const n = generateSample(v, root, depth + 1)
        if (n) result[key] = n
      } else if (v.type === 'array') {
        const item = v.items ? generateSample(v.items, root, depth + 1) : null
        result[key] = item ? [item] : []
      }
    }
    return result
  }
  if (schema.type === 'array') {
    const item = schema.items ? generateSample(schema.items, root, depth + 1) : null
    return item ? [item] : []
  }
  if (schema.enum && schema.enum.length > 0) return schema.enum[0]
  return null
}

// ── OpenAPI parsing ──
function extractBaseUrl(spec: any): string | undefined {
  if (spec.servers && Array.isArray(spec.servers) && spec.servers.length > 0) {
    return spec.servers[0].url.replace(/\/+$/, '')
  }
  if (spec.host) {
    const scheme = (spec.schemes && spec.schemes[0]) || 'https'
    const base = spec.basePath || ''
    return `${scheme}://${spec.host}${base}`.replace(/\/+$/, '')
  }
  return undefined
}

function parseOpenApiSpecToEndpoints(text: string, isJson: boolean): { endpoints: GitHubEndpoint[]; baseUrl?: string } {
  try {
    const spec = isJson ? JSON.parse(text) : simpleYamlParse(text)
    const endpoints: GitHubEndpoint[] = []
    const baseUrl = extractBaseUrl(spec)

    for (const [path, methods] of Object.entries(spec.paths || {})) {
      for (const [method, def] of Object.entries(methods as any)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue
        const d = def as any

        const params: GitHubEndpointParam[] = []
        const headers: { name: string; value: string }[] = []
        if (d.parameters && Array.isArray(d.parameters)) {
          for (const p of d.parameters) {
            const entry: GitHubEndpointParam = {
              name: p.name,
              type: p.schema?.type || 'string',
              required: p.required || false,
              in: p.in || 'path',
            }
            params.push(entry)
            if (p.in === 'header') {
              headers.push({ name: p.name, value: p.schema?.default || p.schema?.example || '' })
            }
          }
        }

        let body: string | undefined
        let contentType: string | undefined
        if (d.requestBody?.content) {
          const jsonContent = d.requestBody.content['application/json']
          if (jsonContent?.schema) {
            contentType = 'application/json'
            const sample = generateSample(jsonContent.schema, spec)
            if (sample) body = JSON.stringify(sample, null, 2)
          }
        }

        endpoints.push({
          method: method.toUpperCase(),
          path,
          summary: d.summary || '',
          description: d.description,
          baseUrl,
          params: params.length > 0 ? params : undefined,
          headers: headers.length > 0 ? headers : undefined,
          body,
          contentType,
        })
      }
    }

    return { endpoints, baseUrl }
  } catch {
    return { endpoints: [], baseUrl: undefined }
  }
}

// ── Main import function ──
export async function importFromGithub(repoUrl: string, forceRefresh = false): Promise<GitHubImportResult> {
  const info = cleanGithubUrl(repoUrl)
  if (!info) throw new Error('URL de GitHub inválida. Ej: https://github.com/owner/repo')

  if (!forceRefresh) {
    const cached = loadCache(repoUrl)
    if (cached) return cached
  }

  const { owner, repo } = info

  const specFiles = ['openapi.json', 'openapi.yml', 'openapi.yaml', 'swagger.json', 'swagger.yaml']
  let endpoints: GitHubEndpoint[] = []
  let openapiUrl: string | undefined
  let baseUrl: string | undefined
  let scanned = false

  for (const file of specFiles) {
    try {
      const raw = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/${file}`)
      if (raw.ok) {
        const text = await raw.text()
        const parsed = parseOpenApiSpecToEndpoints(text, file.endsWith('.json'))
        if (parsed.endpoints.length > 0) {
          endpoints = parsed.endpoints
          baseUrl = parsed.baseUrl
          openapiUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${file}`
          break
        }
      }
    } catch { /* try next */ }
  }

  if (endpoints.length === 0) {
    try {
      endpoints = await guessRoutes(owner, repo)
      scanned = true
    } catch { /* use fallback */ }
  }

  const result: GitHubImportResult = { title: repo, endpoints, openapiUrl, baseUrl, scanned }
  saveCache(repoUrl, result)
  return result
}

// ── Code scanning ──
const CODE_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'rs', 'go', 'java', 'kt', 'php', 'rb'])

const MAX_FILES = 80

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/vnd.github.v3+json' }
  try {
    const token = localStorage.getItem('greq-github-token')
    if (token) h['Authorization'] = `Bearer ${token}`
  } catch { /* not in browser */ }
  return h
}

interface RoutePattern {
  regex: RegExp
  methodIndex: number
  pathIndex: number
  normalize: (m: string) => string
}

function patternsForExt(ext: string): RoutePattern[] {
  const up = (m: string) => m.toUpperCase()
  const keep = (m: string) => m

  if (ext === 'py') {
    return [
      { regex: /@\w+\.(get|post|put|patch|delete|options)\s*\(\s*['"](\/[^'"]*)['"]/gi, methodIndex: 1, pathIndex: 2, normalize: up },
      { regex: /@\w+\.route\s*\(\s*['"](\/[^'"]*)['"]/gi, methodIndex: 0, pathIndex: 1, normalize: () => 'GET' },
      { regex: /@api_view\s*\(\s*\[['"](GET|POST|PUT|PATCH|DELETE)['"]\]/gi, methodIndex: 1, pathIndex: 0, normalize: up },
      { regex: /@api_view\s*\(\s*\[['"](GET|POST|PUT|PATCH|DELETE)['"]\]\s*\)\s*\n\s*def\s+\w+\s*\(/gi, methodIndex: 1, pathIndex: 0, normalize: up },
    ]
  }

  if (ext === 'rs') {
    return [
      { regex: /#\[(get|post|put|patch|delete)\s*\(\s*['"](\/[^'"]*)['"]\s*\)\]/gi, methodIndex: 1, pathIndex: 2, normalize: up },
      { regex: /\.route\s*\(\s*['"]([^'"]+)['"]\s*,\s*(get|post|put|patch|delete)_/gi, methodIndex: 2, pathIndex: 1, normalize: up },
    ]
  }

  if (ext === 'go') {
    return [
      { regex: /\.(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(\s*['"`](\/[^'"`]*)['"`]/gi, methodIndex: 1, pathIndex: 2, normalize: keep },
      { regex: /router\.(GET|POST|PUT|PATCH|DELETE|HEAD)\s*\(\s*['"`](\/[^'"`]*)['"`]/gi, methodIndex: 1, pathIndex: 2, normalize: keep },
      { regex: /(?:r|e|router|mux)\.(GET|POST|PUT|PATCH|DELETE)\s*\(\s*['"`](\/[^'"`]*)['"`]/gi, methodIndex: 1, pathIndex: 2, normalize: keep },
      { regex: /http\.HandleFunc\s*\(\s*['"`](\/[^'"`]*)['"`]/gi, methodIndex: 0, pathIndex: 1, normalize: () => 'GET' },
    ]
  }

  if (ext === 'java' || ext === 'kt') {
    return [
      { regex: /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping)\s*\(\s*['"](\/[^'"]*)['"]\s*\)/gi, methodIndex: 1, pathIndex: 2, normalize: (m: string) => {
        const map: Record<string, string> = { getmapping: 'GET', postmapping: 'POST', putmapping: 'PUT', patchmapping: 'PATCH', deletemapping: 'DELETE' }
        return map[m.toLowerCase()] || 'GET'
      }},
      { regex: /@RequestMapping\s*\(\s*(?:.*\bmethod\s*=\s*(?:RequestMethod\.)?(GET|POST|PUT|PATCH|DELETE)[^)]*)?(?:.*\bvalue\s*=\s*['"](\/[^'"]*)['"]|['"](\/[^'"]*)['"])/gi, methodIndex: 1, pathIndex: 2, normalize: up },
    ]
  }

  if (ext === 'php') {
    return [
      { regex: /Route::(get|post|put|patch|delete)\s*\(\s*['"](\/[^'"]*)['"]/gi, methodIndex: 1, pathIndex: 2, normalize: up },
      { regex: /\$router->(get|post|put|patch|delete)\s*\(\s*['"](\/[^'"]*)['"]/gi, methodIndex: 1, pathIndex: 2, normalize: up },
    ]
  }

  if (ext === 'rb') {
    return [
      { regex: /\b(get|post|put|patch|delete)\s+['"](\/[^'"]*)['"]/gi, methodIndex: 1, pathIndex: 2, normalize: up },
    ]
  }

  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
    return [
      { regex: /\.(get|post|put|patch|delete|head|options)\s*\(\s*['"`](\/[^'"`]*)['"`]/gi, methodIndex: 1, pathIndex: 2, normalize: up },
      { regex: /router\.(get|post|put|patch|delete)\s*\(\s*['"`](\/[^'"`]*)['"`]/gi, methodIndex: 1, pathIndex: 2, normalize: up },
    ]
  }

  return []
}

function extractRoutesFromContent(content: string, ext: string): { method: string; path: string }[] {
  const seen = new Set<string>()
  const results: { method: string; path: string }[] = []

  for (const pattern of patternsForExt(ext)) {
    const regex = new RegExp(pattern.regex.source, 'gi')
    let match: RegExpExecArray | null
    while ((match = regex.exec(content)) !== null) {
      const method = pattern.normalize(match[pattern.methodIndex] ?? 'GET')
      const rawPath = match[pattern.pathIndex]
      if (!rawPath) continue
      const path = rawPath.replace(/:\w+/g, (m: string) => `{${m.slice(1)}}`)
      if (!path || path === '/') continue
      const key = `${method}:${path}`
      if (!seen.has(key)) {
        seen.add(key)
        results.push({ method, path })
      }
    }
  }

  return results
}

function routeFileScore(path: string): number {
  if (/\/?(routes|api|controllers?|handlers?|endpoints|views)\b/i.test(path)) return 3
  const name = path.split('/').pop() ?? path
  if (/\b(server|app|main|router)\b/i.test(name)) return 2
  if (/\.(routes?|controller|handler|endpoint|view)\.\w+$/.test(name)) return 3
  if (/\bapi\b/i.test(path)) return 2
  if (/\/v[12]\//.test(path)) return 1
  return 1
}

async function guessRoutes(owner: string, repo: string): Promise<GitHubEndpoint[]> {
  const endpoints: GitHubEndpoint[] = []
  const seen = new Set<string>()
  let count = 0
  let activeBranch = ''

  const tree = await (async () => {
    for (const branch of ['main', 'master']) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
          { headers: authHeaders() },
        )
        if (res.ok) {
          const json = await res.json()
          activeBranch = branch
          return json.tree ?? []
        }
      } catch { /* try next */ }
    }
    return []
  })()

  if (!activeBranch) return endpoints

  const codeFiles = tree.filter((item: any) => {
    if (item.type !== 'blob') return false
    if (item.path?.includes('node_modules')) return false
    if (item.path?.includes('.git/')) return false
    const ext = (item.path ?? '').split('.').pop()?.toLowerCase()
    return !!ext && CODE_EXTS.has(ext)
  })

  codeFiles.sort((a: any, b: any) => routeFileScore(b.path) - routeFileScore(a.path))

  for (const item of codeFiles) {
    if (count >= MAX_FILES) break
    count++
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${activeBranch}/${item.path}`)
      if (!res.ok) continue
      const ext = (item.path ?? '').split('.').pop()?.toLowerCase()
      const routes = extractRoutesFromContent(await res.text(), ext ?? '')
      for (const { method, path } of routes) {
        const key = `${method}:${path}`
        if (!seen.has(key)) {
          seen.add(key)
          endpoints.push({ method, path, summary: `${method} ${path}` })
        }
      }
    } catch { /* skip */ }
  }

  return endpoints
}

export function invalidateGithubCache(repoUrl: string) {
  try {
    localStorage.removeItem(cacheKey(repoUrl))
  } catch { /* ignore */ }
}
