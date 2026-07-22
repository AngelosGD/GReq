import { randomPort, genId } from '../components/mockApi/types'
import type { MockApiItem } from '../components/mockApi/types'

interface ParsedEndpoint {
  path: string
  method: string
  summary: string
  params: { name: string; type: string }[]
  responseBody: string
}

function resolveJsonPointer(root: any, ref: string): any {
  if (!ref.startsWith('#/')) return undefined
  const parts = ref.slice(2).split('/').map(part =>
    part.replace(/~1/g, '/').replace(/~0/g, '~')
  )
  let current = root
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[part]
  }
  return current
}

function resolveRefsDeep(obj: any, root: any, depth = 0): any {
  if (depth > 20) return obj
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) {
    return obj.map(item => resolveRefsDeep(item, root, depth))
  }
  if (obj.$ref && typeof obj.$ref === 'string') {
    const resolved = resolveJsonPointer(root, obj.$ref)
    if (resolved) return resolveRefsDeep(resolved, root, depth + 1)
    return obj
  }
  const result: any = {}
  for (const [key, val] of Object.entries(obj)) {
    result[key] = resolveRefsDeep(val, root, depth)
  }
  return result
}

function parseYamlValue(val: string): any {
  if (val === 'true' || val === 'false') return val === 'true'
  if (/^\d+$/.test(val)) return parseInt(val, 10)
  if (/^\d+\.\d+$/.test(val)) return parseFloat(val)
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) return val.slice(1, -1)
  if (val.startsWith('[') && val.endsWith(']')) {
    const inner = val.slice(1, -1).trim()
    if (!inner) return []
    return inner.split(',').map(v => parseYamlValue(v.trim()))
  }
  return val
}

export function simpleYamlParse(text: string): any {
  const BLOCK_MARKER: any = {}
  const result: any = {}
  const stack: { obj: any; indent: number; parent?: any; key?: string }[] = [
    { obj: result, indent: -1 },
  ]

  let blockKey: string | null = null
  let blockParent: any = null
  let blockBaseIndent = 0
  let blockLines: string[] = []
  let blockChomp = 'clip'
  let blockStyle = '|'

  function flushBlock(): void {
    if (!blockKey) return
    let text: string
    if (blockStyle === '|') {
      text = blockLines.join('\n')
      if (blockChomp === 'strip') text = text.replace(/\n+$/, '')
      else if (blockChomp === 'clip') text = text.replace(/\n*$/, '\n')
    } else {
      text = blockLines.join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/([^\n])\n(?=[^\n])/g, '$1 ')
      if (blockChomp === 'strip') text = text.replace(/\n+$/, '')
      else if (blockChomp === 'clip') text = text.replace(/\n*$/, '\n')
    }
    blockParent[blockKey] = text
    blockKey = null
    blockParent = null
    blockLines = []
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trimEnd()
    if (!trimmed.trim()) {
      if (blockKey) blockLines.push('')
      continue
    }
    const content = trimmed.trim()
    if (content.startsWith('#') && !blockKey) continue

    const indent = trimmed.length - trimmed.trimStart().length

    if (blockKey) {
      if (indent > blockBaseIndent) {
        blockLines.push(content)
        continue
      } else {
        flushBlock()
      }
    }

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop()
    }

    const current = stack[stack.length - 1]?.obj
    if (!current) continue

    if (content.startsWith('- ')) {
      const remainder = content.slice(2)
      const colonIdx = remainder.indexOf(':')
      const top = stack[stack.length - 1]

      if (colonIdx >= 0) {
        const newObj: any = {}
        if (top.obj === BLOCK_MARKER && top.parent && top.key) {
          const arr: any[] = [newObj]
          top.parent[top.key] = arr
          top.obj = arr
        } else if (Array.isArray(top.obj)) {
          top.obj.push(newObj)
        } else {
          const arr = [newObj]
          const parent = stack[stack.length - 2]?.obj
          if (parent && top.key) parent[top.key] = arr
          top.obj = arr
        }
        const itemKey = remainder.slice(0, colonIdx).trim()
        const itemVal = remainder.slice(colonIdx + 1).trim()
        if (itemVal === '') {
          stack.push({ obj: newObj, indent: indent + 2, parent: newObj, key: itemKey })
        } else {
          newObj[itemKey] = parseYamlValue(itemVal)
        }
      } else {
        const itemVal = parseYamlValue(remainder.trim())
        if (top.obj === BLOCK_MARKER && top.parent && top.key) {
          const arr: any[] = [itemVal]
          top.parent[top.key] = arr
          top.obj = arr
        } else if (Array.isArray(top.obj)) {
          top.obj.push(itemVal)
        }
      }
      continue
    }

    const colonIdx = content.indexOf(':')
    if (colonIdx === -1) continue

    const key = content.slice(0, colonIdx).trim()
    const val = content.slice(colonIdx + 1).trim()

    if (val === '') {
      const newObj: any = {}
      current[key] = newObj
      stack.push({ obj: newObj, indent, parent: current, key })
    } else {
      const blockMatch = val.match(/^([|>])([-+]?\d*|\d*[-+]?)$/)
      if (blockMatch) {
        blockKey = key
        blockParent = current
        blockBaseIndent = indent
        blockLines = []
        blockChomp = blockMatch[2].includes('-') ? 'strip' : blockMatch[2].includes('+') ? 'keep' : 'clip'
        blockStyle = blockMatch[1]
        current[key] = BLOCK_MARKER
        stack.push({ obj: BLOCK_MARKER, indent, parent: current, key })
      } else {
        current[key] = parseYamlValue(val)
      }
    }
  }

  flushBlock()
  return result
}

function extractFieldsFromSchema(schema: any): { name: string; type: string }[] {
  if (!schema || typeof schema !== 'object') return []
  const props = schema.properties
  if (!props || typeof props !== 'object') return []
  const fields: { name: string; type: string }[] = []
  for (const [key, val] of Object.entries(props)) {
    const v = val as any
    let t = 'string'
    if (v.type === 'integer' || v.type === 'number') t = 'int'
    else if (v.type === 'boolean') t = 'bool'
    else if (v.type === 'object') t = 'object'
    else if (v.type === 'array') {
      if (v.items) {
        if (v.items.type) t = `array_${v.items.type}`
        else t = 'array_object'
      } else {
        t = 'array'
      }
    }
    fields.push({ name: key, type: t })
  }
  return fields
}

function schemaToSample(schema: any, depth = 0): any {
  if (!schema || typeof schema !== 'object' || depth > 5) return '{{ejemplo}}'
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  if (schema.enum && schema.enum.length > 0) return schema.enum[0]
  if (schema.type === 'object' || schema.properties) {
    const obj: any = {}
    if (schema.properties) {
      for (const [key, val] of Object.entries(schema.properties)) {
        obj[key] = schemaToSample(val as any, depth + 1)
      }
    }
    return obj
  }
  if (schema.type === 'array') {
    if (schema.items) return [schemaToSample(schema.items, depth + 1)]
    return []
  }
  if (schema.type === 'integer' || schema.type === 'number') return 1
  if (schema.type === 'boolean') return true
  return 'ejemplo'
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
      const sample = schema ? schemaToSample(schema) : null
      endpoints.push({
        path: path.replace(/\{(\w+)\}/g, ':$1'),
        method: method.toUpperCase(),
        summary: d.summary || `${method.toUpperCase()} ${path}`,
        params: fields.length > 0 ? fields : bodyFields,
        responseBody: sample ? JSON.stringify(sample, null, 2) : JSON.stringify({ id: 1, name: 'ejemplo' }, null, 2),
      })
    }
  }
  return endpoints
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

  spec = resolveRefsDeep(spec, spec)

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

    const methodBodies: Record<string, { statusCode: number; responseBody: string; responseHeaders: { key: string; value: string }[] }> = {}
    let defaultResponseBody = JSON.stringify({ id: 1, name: 'ejemplo' }, null, 2)
    for (const ep of eps) {
      if (ep.responseBody) {
        methodBodies[ep.method] = { statusCode: 200, responseBody: ep.responseBody, responseHeaders: [] }
        defaultResponseBody = ep.responseBody
      }
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
      methodBodies,
      fields: allFields,
      sampleData,
      pinned: false,
      responseBody: defaultResponseBody,
    })
  }

  return apis
}
