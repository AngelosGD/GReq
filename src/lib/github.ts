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

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  })
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`)
  return res.json()
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

  // If no spec found, try to list repo contents and find routes in code
  if (endpoints.length === 0) {
    try {
      const contents = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/contents`)
      endpoints = await guessRoutes(contents, owner, repo)
    } catch { /* use fallback */ }
  }

  // Fallback: generate common REST endpoints based on repo name
  if (endpoints.length === 0) {
    const resource = repo.replace(/[-_]/g, ' ').toLowerCase().includes('api') ? repo : `${repo}/api`
    endpoints = [
      { method: 'GET', path: `/${resource}`, summary: `List ${repo}` },
      { method: 'GET', path: `/${resource}/{id}`, summary: `Get ${repo} by ID` },
      { method: 'POST', path: `/${resource}`, summary: `Create ${repo}` },
    ]
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

async function guessRoutes(contents: any[], owner: string, repo: string): Promise<GitHubEndpoint[]> {
  const dirs = contents.filter((c: any) => c.type === 'dir')
  const endpoints: GitHubEndpoint[] = []

  for (const dir of dirs.slice(0, 5)) {
    try {
      const files = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/contents/${dir.name}`)
      for (const file of files) {
        const match = file.name?.match(/\.(routes|controller|handler|api)\.(ts|js|py|rs)$/i)
        if (match) {
          endpoints.push({
            method: 'GET',
            path: `/api/${dir.name}`,
            summary: `Endpoints in ${dir.name}`,
          })
        }
      }
    } catch { /* skip */ }
  }

  return endpoints
}
