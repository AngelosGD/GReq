import { randomPort, genId } from '../components/mockApi/types'
import type { MockApiItem } from '../components/mockApi/types'

interface ParsedEndpoint {
  path: string
  method: string
  summary: string
  params: { name: string; type: string }[]
}

function extractFieldsFromSchema(schema: any): { name: string; type: string }[] {
  if (!schema) return []
  const ref = schema.$ref || schema.properties
  const props = ref || schema.properties
  if (!props || typeof props !== 'object') return []
  const fields: { name: string; type: string }[] = []
  for (const [key, val] of Object.entries(props)) {
    const v = val as any
    let t = 'string'
    if (v.type === 'integer' || v.type === 'number') t = 'int'
    else if (v.type === 'boolean') t = 'bool'
    else if (v.type === 'object' || v.type === 'array') continue
    fields.push({ name: key, type: t })
  }
  return fields
}

function parsePaths(spec: any): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = []
  const paths = spec.paths || {}
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, def] of Object.entries(methods as any)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue
      const d = def as any
      const statusCode = d.responses?.['200'] || d.responses?.['201'] || {}
      const schema = statusCode.content?.['application/json']?.schema
      const fields = extractFieldsFromSchema(schema)
      const bodySchema = d.requestBody?.content?.['application/json']?.schema
      const bodyFields = extractFieldsFromSchema(bodySchema)
      endpoints.push({
        path: path.replace(/\{(\w+)\}/g, ':$1'),
        method: method.toUpperCase(),
        summary: d.summary || `${method.toUpperCase()} ${path}`,
        params: fields.length > 0 ? fields : bodyFields,
      })
    }
  }
  return endpoints
}

function simpleYamlParse(text: string): any {
  const result: any = {}
  const stack: { obj: any; indent: number }[] = [{ obj: result, indent: -1 }]

  for (const line of text.split('\n')) {
    const trimmed = line.trimEnd()
    if (!trimmed.trim() || trimmed.trim().startsWith('#')) continue
    const indent = trimmed.length - trimmed.trimStart().length
    const content = trimmed.trim()

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop()
    }

    const current = stack[stack.length - 1]?.obj
    if (!current) continue

    const colonIdx = content.indexOf(':')
    if (colonIdx === -1) continue

    const key = content.slice(0, colonIdx).trim()
    const val = content.slice(colonIdx + 1).trim()

    if (val === '') {
      const newObj: any = {}
      current[key] = newObj
      stack.push({ obj: newObj, indent })
    } else {
      current[key] = parseYamlValue(val)
    }
  }

  return result
}

function parseYamlValue(val: string): any {
  if (val === 'true' || val === 'false') return val === 'true'
  if (/^\d+$/.test(val)) return parseInt(val, 10)
  if (/^\d+\.\d+$/.test(val)) return parseFloat(val)
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) return val.slice(1, -1)
  return val
}

export function parseOpenApiSpec(text: string): Partial<MockApiItem>[] {
  let spec: any
  try {
    spec = JSON.parse(text)
  } catch {
    try {
      spec = simpleYamlParse(text)
    } catch {
      throw new Error('No se pudo parsear el archivo OpenAPI (JSON ni YAML)')
    }
  }

  const info = spec.info || {}
  const endpoints = parsePaths(spec)
  if (endpoints.length === 0) throw new Error('No se encontraron endpoints en la especificación')

  const grouped = new Map<string, ParsedEndpoint[]>()
  for (const ep of endpoints) {
    const basePath = '/' + ep.path.split('/').filter(Boolean).slice(0, -1).join('/')
    if (!grouped.has(basePath)) grouped.set(basePath, [])
    grouped.get(basePath)!.push(ep)
  }

  const apis: Partial<MockApiItem>[] = []
  for (const [basePath, eps] of grouped) {
    const allMethods = [...new Set(eps.map((e) => e.method))]
    const allFields = [...new Map(eps.flatMap((e) => e.params.map((p) => [p.name, p] as const))).values()]
    const sampleData: Record<string, string>[] = []
    if (allFields.length > 0) {
      const row: Record<string, string> = {}
      for (const f of allFields) {
        row[f.name] = f.type === 'int' ? '1' : f.type === 'bool' ? 'true' : `${f.name}_ejemplo`
      }
      sampleData.push(row)
    }

    apis.push({
      id: genId(),
      name: eps[0].summary.split(' ').slice(0, 3).join(' ') || info.title || 'API',
      methods: allMethods,
      path: basePath.replace(/^\//, ''),
      port: randomPort(),
      running: false,
      serverId: null,
      statusCode: 200,
      responseHeaders: [],
      delayMs: 0,
      methodBodies: {},
      fields: allFields,
      sampleData,
      pinned: false,
      responseBody: sampleData.length > 0
        ? JSON.stringify(sampleData.map((row, i) => ({ id: i + 1, ...row })), null, 2)
        : JSON.stringify({ id: 1, name: 'ejemplo' }, null, 2),
    })
  }

  return apis
}
