import type { Node, Edge } from '@xyflow/react'
import { getUrlData, getMethodData } from '../utils/nodeData'
import type { KeyValuePair } from '../types'
import { useEnvStore } from '../store/envStore'

export interface CodegenGroup {
  title: string
  url: string
  method: string
  headers: KeyValuePair[]
  body: string
  bodyType: string
  auth: string
  authValue: string
  params: KeyValuePair[]
}

export type CodegenLang = 'curl' | 'httpie' | 'python' | 'javascript' | 'rust'

function buildGroups(nodes: Node[], edges: Edge[]): CodegenGroup[] {
  const urlNodes = nodes.filter((n) => n.type === 'url')
  const groups: CodegenGroup[] = []

  for (const urlNode of urlNodes) {
    const urlData = getUrlData(urlNode)
    const urlHeaders = (urlData.headers as KeyValuePair[]) ?? []
    const methodEdges = edges.filter((e) => e.source === urlNode.id)
    for (const e of methodEdges) {
      const methodNode = nodes.find((n) => n.id === e.target)
      if (!methodNode || methodNode.type !== 'method') continue
      const methodData = getMethodData(methodNode)
      const mergedHeaders = [...urlHeaders, ...((methodData.headers as KeyValuePair[]) ?? [])]
      groups.push({
        title: (urlData.title as string) || 'Sin título',
        url: (urlData.url as string) || '',
        method: (methodData.method as string) || 'GET',
        headers: mergedHeaders,
        body: (methodData.body as string) || '',
        bodyType: (methodData.bodyType as string) || 'json',
        auth: (methodData.auth as string) || 'None',
        authValue: (methodData.authValue as string) || '',
        params: (urlData.params as KeyValuePair[]) || [],
      })
    }
  }

  return groups
}

function hasAuthHeader(headers: KeyValuePair[]): boolean {
  return headers.some((h) => h.key.toLowerCase() === 'authorization')
}

function methodFlag(m: string): string {
  return m === 'GET' ? '' : ` -X ${m}`
}

function quote(s: string): string {
  const escaped = s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`')
  return `"${escaped}"`
}

function indent(text: string, level: number): string {
  const spaces = '  '.repeat(level)
  return text.split('\n').map((l) => spaces + l).join('\n')
}

function buildQueryString(params: KeyValuePair[]): string {
  const qs = params
    .filter((p) => p.key)
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&')
  return qs ? '?' + qs : ''
}

function genCurl(g: CodegenGroup): string {
  const urlWithParams = g.url + buildQueryString(g.params)
  const lines: string[] = ['curl' + methodFlag(g.method) + ' ' + quote(urlWithParams)]

  for (const h of g.headers) {
    if (h.key) lines.push(`  -H ${quote(`${h.key}: ${h.value}`)}`)
  }

  if (g.auth === 'Bearer' && g.authValue && !hasAuthHeader(g.headers)) {
    lines.push(`  -H ${quote(`Authorization: Bearer ${g.authValue}`)}`)
  } else if (g.auth === 'Basic' && g.authValue && !hasAuthHeader(g.headers)) {
    lines.push(`  -u ${quote(g.authValue)}`)
  }

  if (g.body && g.method !== 'GET') {
    if (g.bodyType === 'form') {
      lines.push(`  -d ${quote(g.body)}`)
    } else {
      lines.push(`  -d ${quote(g.body)}`)
      if (!g.headers.some((h) => h.key.toLowerCase() === 'content-type')) {
        lines.push(`  -H "Content-Type: application/json"`)
      }
    }
  }

  return lines.join(' \\\n')
}

function genHttpie(g: CodegenGroup): string {
  const method = g.method.toLowerCase()
  const methodFlagHttp = method === 'get' ? '' : ` ${g.method}`
  const urlWithParams = g.url + buildQueryString(g.params)

  const parts: string[] = [`http${methodFlagHttp} ${quote(urlWithParams)}`]

  for (const h of g.headers) {
    if (h.key) parts.push(`  ${h.key}:${h.value}`)
  }

  if (g.auth === 'Bearer' && g.authValue && !hasAuthHeader(g.headers)) {
    parts.push(`  Authorization:Bearer ${g.authValue}`)
  } else if (g.auth === 'Basic' && g.authValue && !hasAuthHeader(g.headers)) {
    const [user, pass] = g.authValue.split(':')
    parts.push(`  -a ${quote(user ?? '')}${pass != null ? `:${quote(pass)}` : ''}`)
  }

  if (g.body && method !== 'get') {
    if (g.bodyType !== 'form') {
      try {
        const parsed = JSON.parse(g.body)
        for (const [k, v] of Object.entries(parsed)) {
          const val = typeof v === 'string' ? quote(String(v)) : String(v)
          parts.push(`  ${k}=${val}`)
        }
      } catch {
        parts.push(`  --raw ${quote(g.body)}`)
      }
    } else {
      parts.push(`  --form ${quote(g.body)}`)
    }
  }

  return parts.join(' \\\n')
}

function genPython(g: CodegenGroup): string {
  const lines: string[] = []
  const kwargs: string[] = []

  const method = g.method.toLowerCase()
  kwargs.push(quote(g.url))

  if (method !== 'get') {
    kwargs.push(quote(g.method))
  }

  const headers: Record<string, string> = {}
  for (const h of g.headers) {
    if (h.key) headers[h.key] = h.value
  }
  if (g.auth === 'Bearer' && g.authValue && !hasAuthHeader(g.headers)) {
    headers['Authorization'] = `Bearer ${g.authValue}`
  }
  if (Object.keys(headers).length > 0) {
    const h = JSON.stringify(headers, null, 4)
    kwargs.push(`headers=${h.replace(/\n/g, '\n    ')}`)
  }

  if (g.body && method !== 'get') {
    if (g.bodyType === 'form') {
      kwargs.push(`data=${quote(g.body)}`)
    } else {
      try {
        const parsed = JSON.parse(g.body)
        const pyBody = JSON.stringify(parsed, null, 2)
          .replace(/: true\b/g, ': True')
          .replace(/: false\b/g, ': False')
          .replace(/: null\b/g, ': None')
        kwargs.push(`json=${pyBody}`)
      }
      catch { kwargs.push(`data=${quote(g.body)}`) }
    }
  }

  if (g.params.length > 0) {
    const p = JSON.stringify(Object.fromEntries(g.params.filter((p) => p.key).map((p) => [p.key, p.value])))
    kwargs.push(`params=${p}`)
  }

  const call = kwargs.length > 0
    ? `requests.${method}(\n${indent(kwargs.join(',\n'), 1)}\n)`
    : `requests.${method}(${kwargs[0] ?? ''})`

  lines.push(`response = ${call}`)
  lines.push('print(response.json())')
  return lines.join('\n')
}

function genJavaScript(g: CodegenGroup): string {
  const init: Record<string, unknown> = { method: g.method }

  const headers: Record<string, string> = {}
  for (const h of g.headers) {
    if (h.key) headers[h.key] = h.value
  }
  if (g.auth === 'Bearer' && g.authValue && !hasAuthHeader(g.headers)) {
    headers['Authorization'] = `Bearer ${g.authValue}`
  }
  if (Object.keys(headers).length > 0) {
    init.headers = headers
  }

  if (g.body && g.method !== 'GET') {
    if (g.bodyType === 'form') {
      init.body = g.body
    } else {
      if (!g.headers.some((h) => h.key.toLowerCase() === 'content-type')) {
        init.headers = { ...(init.headers as Record<string, string>), 'Content-Type': 'application/json' }
      }
      try {
        JSON.parse(g.body)
        init.body = g.body
      } catch {
        init.body = JSON.stringify(g.body)
      }
    }
  }

  const urlWithParams = g.url + buildQueryString(g.params)

  const initStr = JSON.stringify(init, null, 2)
    .replace(/"(\w+)":/g, '$1:')

  return [
    `fetch("${urlWithParams}", ${initStr})`,
    `  .then(r => r.json())`,
    `  .then(data => console.log(data))`,
    `  .catch(err => console.error(err))`,
  ].join('\n')
}

function genRust(g: CodegenGroup): string {
  const lines: string[] = []

  const method = g.method.toLowerCase()
  const clientVar = '  let client = reqwest::Client::new();'

  let reqLine = `  let resp = client.${method}("${g.url}${buildQueryString(g.params)}")`

  for (const h of g.headers) {
    if (h.key) reqLine += `\n    .header("${h.key}", "${h.value}")`
  }

  if (g.auth === 'Bearer' && g.authValue && !hasAuthHeader(g.headers)) {
    reqLine += `\n    .bearer_auth("${g.authValue}")`
  } else if (g.auth === 'Basic' && g.authValue && !hasAuthHeader(g.headers)) {
    const [basicUser, basicPass] = g.authValue.split(':')
    reqLine += `\n    .basic_auth("${basicUser ?? ''}", ${basicPass != null ? `Some("${basicPass}")` : 'None::<String>'})`
  }

  if (g.body && method !== 'get') {
    if (g.bodyType === 'form') {
      reqLine += `\n    .form(&${g.body})`
    } else {
      try {
        JSON.parse(g.body)
        reqLine += `\n    .json(&serde_json::json!(${g.body}))`
      } catch {
        reqLine += `\n    .body("${g.body.replace(/"/g, '\\"')}")`
      }
    }
  }

  reqLine += `\n    .send()`
  reqLine += `\n    .await?;`

  lines.push(clientVar)
  lines.push('')
  lines.push(reqLine)
  lines.push('')
  lines.push('  let body = resp.text().await?;')
  lines.push('  println!("{}", body);')
  lines.push('  Ok(())')

  return lines.join('\n')
}

function resolveTemplates(val: string, vars: Record<string, string>): string {
  return val.replace(/\{\{(.+?)\}\}/g, (_match, expr) => {
    const trimmed = expr.trim()
    return vars[trimmed] !== undefined ? vars[trimmed] : _match
  })
}

function resolveGroup(g: CodegenGroup, vars: Record<string, string>): CodegenGroup {
  return {
    ...g,
    title: resolveTemplates(g.title, vars),
    url: resolveTemplates(g.url, vars),
    headers: g.headers.map((h) => ({ key: resolveTemplates(h.key, vars), value: resolveTemplates(h.value, vars) })),
    body: resolveTemplates(g.body, vars),
    authValue: resolveTemplates(g.authValue, vars),
    params: g.params.map((p) => ({ key: resolveTemplates(p.key, vars), value: resolveTemplates(p.value, vars) })),
  }
}

function genPrelude(lang: CodegenLang, groups: CodegenGroup[]): string {
  switch (lang) {
    case 'python':
      return 'import requests\n\n'
    case 'rust': {
      const single = groups.length === 1
      const lines: string[] = ['// cargo add reqwest --features json', 'use reqwest;', '']
      if (single) {
        lines.push('#[tokio::main]')
        lines.push('async fn main() -> Result<(), reqwest::Error> {')
      }
      return lines.join('\n') + '\n'
    }
    default:
      return ''
  }
}

function genPostlude(lang: CodegenLang, groups: CodegenGroup[]): string {
  if (lang === 'rust' && groups.length === 1) return '\n}'
  return ''
}

export function generateCode(nodes: Node[], edges: Edge[], lang: CodegenLang, resolveVars: boolean): string {
  let groups = buildGroups(nodes, edges)
  if (groups.length === 0) return '// No hay endpoints para exportar'

  if (resolveVars) {
    const envVars = Object.fromEntries(useEnvStore.getState().getActiveVars().map((v) => [v.key, v.value]))
    groups = groups.map((g) => resolveGroup(g, envVars))
  }

  const genMap: Record<CodegenLang, (g: CodegenGroup) => string> = {
    curl: genCurl,
    httpie: genHttpie,
    python: genPython,
    javascript: genJavaScript,
    rust: genRust,
  }

  const gen = genMap[lang]
  const all = groups.map((g) => {
    const code = gen(g)
    const sep = lang === 'curl' || lang === 'httpie' ? '# ' : '// '
    return `${sep}${g.title} — ${g.method} ${g.url}\n${code}`
  })

  const prelude = genPrelude(lang, groups)
  const postlude = genPostlude(lang, groups)
  const wrapInMain = lang === 'rust' && groups.length === 1

  if (wrapInMain) {
    return prelude + indent(all.join('\n\n'), 1) + postlude
  }

  if (lang === 'rust') {
    return prelude + all.join('\n\n')
  }

  return prelude + all.join('\n\n')
}

export function countGroups(nodes: Node[], edges: Edge[]): number {
  return buildGroups(nodes, edges).length
}

export function getFileExtension(lang: CodegenLang): string {
  switch (lang) {
    case 'curl': return 'sh'
    case 'httpie': return 'sh'
    case 'python': return 'py'
    case 'javascript': return 'js'
    case 'rust': return 'rs'
  }
}

export function getMimeType(lang: CodegenLang): string {
  switch (lang) {
    case 'curl':
    case 'httpie': return 'text/x-shellscript'
    case 'python': return 'text/x-python'
    case 'javascript': return 'text/javascript'
    case 'rust': return 'text/x-rust'
  }
}
