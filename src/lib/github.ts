export interface GitHubEndpoint {
  method: string
  path: string
  summary: string
}

export interface GitHubImportResult {
  title: string
  endpoints: GitHubEndpoint[]
  openapiUrl?: string
}

function cleanGithubUrl(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/\s?#]+)/)
  if (!m) return null
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') }
}

export async function importFromGithub(repoUrl: string): Promise<GitHubImportResult> {
  const info = cleanGithubUrl(repoUrl)
  if (!info) throw new Error('URL de GitHub inválida. Ej: https://github.com/owner/repo')

  const { owner, repo } = info

  // Try to fetch common API spec files from the repo root
  const specFiles = ['openapi.json', 'openapi.yml', 'openapi.yaml', 'swagger.json', 'swagger.yaml']
  let endpoints: GitHubEndpoint[] = []
  let openapiUrl: string | undefined

  for (const file of specFiles) {
    try {
      const raw = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/${file}`)
      if (raw.ok) {
        const text = await raw.text()
        const parsed = parseOpenApi(text, file.endsWith('.json'))
        if (parsed.length > 0) {
          endpoints = parsed
          openapiUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${file}`
          break
        }
      }
    } catch { /* try next */ }
  }

  if (endpoints.length === 0) {
    try {
      endpoints = await guessRoutes(owner, repo)
    } catch { /* use fallback */ }
  }

  return {
    title: repo,
    endpoints,
    openapiUrl,
  }
}

function parseOpenApi(text: string, isJson: boolean): GitHubEndpoint[] {
  try {
    const spec = isJson ? JSON.parse(text) : simpleYamlParse(text)
    const paths = spec.paths || {}
    const endpoints: GitHubEndpoint[] = []

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, def] of Object.entries(methods as any)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue
        endpoints.push({
          method: method.toUpperCase(),
          path,
          summary: (def as any)?.summary || `${method.toUpperCase()} ${path}`,
        })
      }
    }

    return endpoints
  } catch {
    return []
  }
}

function simpleYamlParse(text: string): any {
  // Minimal YAML parser for OpenAPI specs
  const result: any = { paths: {} }
  let currentPath = ''
  let currentMethod = ''

  for (const line of text.split('\n')) {
    const trimmed = line.trimStart()

    if (trimmed.startsWith('paths:')) {
      continue
    }

    if (trimmed.startsWith('/') && trimmed.includes(':')) {
      const parts = trimmed.split(':')
      currentPath = parts[0].trim()
      if (!result.paths[currentPath]) result.paths[currentPath] = {}
      continue
    }

    if ((trimmed.startsWith('get') || trimmed.startsWith('post') || trimmed.startsWith('put') || trimmed.startsWith('patch') || trimmed.startsWith('delete')) && trimmed.includes(':')) {
      currentMethod = trimmed.split(':')[0].trim()
      if (!result.paths[currentPath]) result.paths[currentPath] = {}
      result.paths[currentPath][currentMethod] = { summary: '' }
      continue
    }

    if (trimmed.startsWith('summary:') && currentPath && currentMethod) {
      result.paths[currentPath][currentMethod].summary = trimmed.slice(8).trim().replace(/^["']|["']$/g, '')
    }
  }

  return result
}

const CODE_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'rs', 'go', 'java', 'kt'])

const MAX_FILES = 30

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/vnd.github.v3+json' }
  try {
    const token = localStorage.getItem('greq-github-token')
    if (token) h['Authorization'] = `Bearer ${token}`
  } catch { /* not in browser */ }
  return h
}

function patternsForExt(ext: string): [RegExp, (m: string) => string][] {
  const up = (m: string) => m.toUpperCase()

  if (ext === 'py') {
    return [
      [/@\w+\.(get|post|put|patch|delete)\s*\(\s*['"](\/[^'"]*)['"]/gi, up],
      [/@\w+\.route\s*\(\s*['"](\/[^'"]*)['"]/gi, () => 'GET'],
    ]
  }

  if (ext === 'rs') {
    return [
      [/#\[(get|post|put|patch|delete)\s*\(\s*['"](\/[^'"]*)['"]\s*\)\]/gi, up],
    ]
  }

  if (ext === 'go') {
    return [
      [/\.(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(\s*['"`](\/[^'"`]*)['"`]/gi, (m: string) => m],
    ]
  }

  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
    return [
      [/\.(get|post|put|patch|delete|head|options)\s*\(\s*['"`](\/[^'"`]*)['"`]/gi, up],
    ]
  }

  return []
}

function extractRoutesFromContent(content: string, ext: string): { method: string; path: string }[] {
  const seen = new Set<string>()
  const results: { method: string; path: string }[] = []

  for (const [pattern, norm] of patternsForExt(ext)) {
    const regex = new RegExp(pattern.source, 'gi')
    let match: RegExpExecArray | null
    while ((match = regex.exec(content)) !== null) {
      let method = norm(match[1] ?? 'GET')
      let path = match[match.length - 1].replace(/:\w+/g, (m) => `{${m.slice(1)}}`)
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
  const name = path.split('/').pop() ?? path
  if (/\/?(routes|api|controllers?|handlers?|endpoints)\b/i.test(path)) return 3
  if (/\b(server|app|main|router)\b/i.test(name)) return 2
  if (/\.(routes?|controller|handler|endpoint)\.\w+$/.test(name)) return 3
  if (/\bapi\b/i.test(name)) return 2
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

  if (!activeBranch) {
    return endpoints
  }

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
