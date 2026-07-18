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

export type CodegenLang = 'curl' | 'python' | 'javascript' | 'rust'

function buildGroups(nodes: Node[], edges: Edge[]): CodegenGroup[] {
  const urlNodes = nodes.filter((n) => n.type === 'url')
  const groups: CodegenGroup[] = []

  for (const urlNode of urlNodes) {
    const urlData = getUrlData(urlNode)
    const methodEdges = edges.filter((e) => e.source === urlNode.id)
    for (const e of methodEdges) {
      const methodNode = nodes.find((n) => n.id === e.target)
      if (!methodNode || methodNode.type !== 'method') continue
      const methodData = getMethodData(methodNode)
      groups.push({
        title: (urlData.title as string) || 'Sin título',
        url: (urlData.url as string) || '',
        method: (methodData.method as string) || 'GET',
        headers: (methodData.headers as KeyValuePair[]) || [],
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

function methodFlag(m: string): string {
  return m === 'GET' ? '' : ` -X ${m}`
}

function quote(s: string): string {
  const escaped = s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${escaped}"`
}

function indent(text: string, level: number): string {
  const spaces = '  '.repeat(level)
  return text.split('\n').map((l) => spaces + l).join('\n')
}

function genCurl(g: CodegenGroup): string {
  const lines: string[] = ['curl' + methodFlag(g.method) + ' ' + quote(g.url)]

  for (const h of g.headers) {
    if (h.key) lines.push(`  -H ${quote(`${h.key}: ${h.value}`)}`)
  }

  if (g.auth === 'Bearer' && g.authValue) {
    lines.push(`  -H ${quote(`Authorization: Bearer ${g.authValue}`)}`)
  } else if (g.auth === 'Basic' && g.authValue) {
    lines.push(`  -u ${quote(g.authValue)}`)
  }

  if (g.params.length > 0) {
    const qs = g.params
      .filter((p) => p.key)
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&')
    if (qs) lines.push(`  -d ${quote(qs)}`)
  }

  if (g.body && g.method !== 'GET') {
    if (g.bodyType === 'form') {
      lines.push(`  -d ${quote(g.body)}`)
    } else {
      lines.push(`  -d ${quote(g.body)}`)
      lines.push(`  -H "Content-Type: application/json"`)
    }
  }

  return lines.join(' \\\n')
}

function genPython(g: CodegenGroup): string {
  const lines: string[] = ['import requests', '']
  const kwargs: string[] = []

  const method = g.method.toLowerCase()
  kwargs.push(`${quote(g.url)}`)

  if (method !== 'get') {
    kwargs.push(`${quote(g.method)}`)
  }

  const headers: Record<string, string> = {}
  for (const h of g.headers) {
    if (h.key) headers[h.key] = h.value
  }
  if (g.auth === 'Bearer' && g.authValue) {
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
  if (g.auth === 'Bearer' && g.authValue) {
    headers['Authorization'] = `Bearer ${g.authValue}`
  }
  if (Object.keys(headers).length > 0) {
    init.headers = headers
  }

  if (g.body && g.method !== 'GET') {
    if (g.bodyType === 'form') {
      init.body = g.body
    } else {
      init.headers = { ...(init.headers as Record<string, string>), 'Content-Type': 'application/json' }
      init.body = g.body
    }
  }

  let qs = ''
  if (g.params.length > 0) {
    qs = '?' + g.params.filter((p) => p.key).map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
  }

  const initStr = JSON.stringify(init, null, 2)
    .replace(/"(\w+)":/g, '$1:')

  return [
    `fetch("${g.url}${qs}", ${initStr})`,
    `  .then(r => r.json())`,
    `  .then(data => console.log(data))`,
    `  .catch(err => console.error(err))`,
  ].join('\n')
}

function genRust(g: CodegenGroup): string {
  const lines: string[] = [
    'use reqwest;',
    '',
    '#[tokio::main]',
    'async fn main() -> Result<(), reqwest::Error> {',
  ]

  const method = g.method.toLowerCase()
  const clientVar = '  let client = reqwest::Client::new();'

  let reqLine = `  let resp = client.${method}("${g.url}")`

  for (const h of g.headers) {
    if (h.key) reqLine += `\n    .header("${h.key}", "${h.value}")`
  }

  if (g.auth === 'Bearer' && g.authValue) {
    reqLine += `\n    .bearer_auth("${g.authValue}")`
  } else if (g.auth === 'Basic' && g.authValue) {
    const [basicUser, basicPass] = g.authValue.split(':')
    reqLine += `\n    .basic_auth("${basicUser ?? ''}", ${basicPass != null ? `Some("${basicPass}")` : 'None::<String>'})`
  }

  if (g.body && method !== 'get') {
    if (g.bodyType === 'form') {
      reqLine += `\n    .form(&${g.body})`
    } else {
      reqLine += `\n    .json(&${g.body})`
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
  lines.push('}')

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

export function generateCode(nodes: Node[], edges: Edge[], lang: CodegenLang, resolveVars: boolean): string {
  let groups = buildGroups(nodes, edges)
  if (groups.length === 0) return '// No hay nodos para exportar'

  if (resolveVars) {
    const envVars = Object.fromEntries(useEnvStore.getState().getActiveVars().map((v) => [v.key, v.value]))
    groups = groups.map((g) => resolveGroup(g, envVars))
  }

  const genMap: Record<CodegenLang, (g: CodegenGroup) => string> = {
    curl: genCurl,
    python: genPython,
    javascript: genJavaScript,
    rust: genRust,
  }

  const gen = genMap[lang]
  const all = groups.map((g) => {
    const code = gen(g)
    const sep = lang === 'curl' ? '# ' : '// '
    return `${sep}${g.title} — ${g.method} ${g.url}\n${code}`
  })

  return all.join('\n\n')
}

export function countGroups(nodes: Node[], edges: Edge[]): number {
  return buildGroups(nodes, edges).length
}
