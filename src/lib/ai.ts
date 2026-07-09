import { useAIStore } from '../store/aiStore'

/* ─── Template local (100% offline, sin descargas ni API key) ─── */

const COMMON_FIELDS: Record<string, { name: string; type: string }[]> = {
  usuario: [
    { name: 'id', type: 'int' },
    { name: 'nombre', type: 'string' },
    { name: 'email', type: 'string' },
  ],
  user: [
    { name: 'id', type: 'int' },
    { name: 'name', type: 'string' },
    { name: 'email', type: 'string' },
  ],
  producto: [
    { name: 'id', type: 'int' },
    { name: 'nombre', type: 'string' },
    { name: 'precio', type: 'int' },
    { name: 'stock', type: 'int' },
  ],
  product: [
    { name: 'id', type: 'int' },
    { name: 'name', type: 'string' },
    { name: 'price', type: 'int' },
  ],
  orden: [
    { name: 'id', type: 'int' },
    { name: 'total', type: 'int' },
    { name: 'estado', type: 'string' },
  ],
  order: [
    { name: 'id', type: 'int' },
    { name: 'total', type: 'int' },
    { name: 'status', type: 'string' },
  ],
  tarea: [
    { name: 'id', type: 'int' },
    { name: 'titulo', type: 'string' },
    { name: 'completada', type: 'bool' },
  ],
  task: [
    { name: 'id', type: 'int' },
    { name: 'title', type: 'string' },
    { name: 'completed', type: 'bool' },
  ],
  libro: [
    { name: 'id', type: 'int' },
    { name: 'titulo', type: 'string' },
    { name: 'autor', type: 'string' },
  ],
  book: [
    { name: 'id', type: 'int' },
    { name: 'title', type: 'string' },
    { name: 'author', type: 'string' },
  ],
  comentario: [
    { name: 'id', type: 'int' },
    { name: 'cuerpo', type: 'string' },
    { name: 'fecha', type: 'string' },
  ],
  comment: [
    { name: 'id', type: 'int' },
    { name: 'body', type: 'string' },
    { name: 'date', type: 'string' },
  ],
}

const DEFAULT_FIELDS = [
  { name: 'id', type: 'int' },
  { name: 'nombre', type: 'string' },
]

function detectEntity(desc: string): string {
  const lower = desc.toLowerCase()
  const entities = Object.keys(COMMON_FIELDS)
  for (const e of entities) {
    if (lower.includes(e.toLowerCase())) return e
  }
  const words = lower.split(/\s+/).filter((w) => w.length > 3)
  return words.length > 0 ? words[words.length - 1] : 'recurso'
}

function pickMethods(desc: string): string[] {
  const lower = desc.toLowerCase()
  const has = (w: string) => lower.includes(w)
  const methods: string[] = []
  if (has('get') || has('obtener') || has('listar')) methods.push('GET')
  if (has('post') || has('crear') || has('nuev')) methods.push('POST')
  if (has('put') || has('update') || has('actualizar') || has('modificar')) methods.push('PUT')
  if (has('delete') || has('eliminar') || has('borrar')) methods.push('DELETE')
  if (methods.length === 0) methods.push('GET', 'POST')
  return methods
}

function generateName(desc: string, entity: string): string {
  const words = desc.split(/\s+/).slice(0, 4).join(' ')
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return words.length > 10 ? `${cap(entity)} API` : cap(words)
}

function generateBody(fields: { name: string; type: string }[]): string {
  const obj: Record<string, unknown> = {}
  for (const f of fields) {
    if (f.type === 'int') obj[f.name] = 1
    else if (f.type === 'bool') obj[f.name] = true
    else obj[f.name] = f.name === 'email' ? 'ejemplo@correo.com' : `${f.name}_ejemplo`
  }
  return JSON.stringify(obj, null, 2)
}

function templateMockApi(description: string) {
  const entity = detectEntity(description)
  const fields = COMMON_FIELDS[entity] ?? DEFAULT_FIELDS
  return {
    name: generateName(description, entity),
    path: `/api/${entity}s`.toLowerCase(),
    methods: pickMethods(description),
    fields,
    body: generateBody(fields),
  }
}

function templateFlow(description: string) {
  const baseUrl = 'https://jsonplaceholder.typicode.com'
  const entity = detectEntity(description)
  const entityPlural = `${entity}s`.toLowerCase()

  const urlNode = {
    type: 'url' as const,
    position: { x: 0, y: 0 },
    data: {
      url: `${baseUrl}/${entityPlural}`,
      title: `Obtener ${entityPlural}`,
      params: [],
      headers: [],
    },
  }

  const method = pickMethods(description)[0] === 'POST' ? 'POST' as const : 'GET' as const
  const methodNode = {
    type: 'method' as const,
    position: { x: 350, y: 0 },
    data: {
      method: method as string,
      headers: [],
      body: method === 'POST' ? generateBody(COMMON_FIELDS[entity] ?? DEFAULT_FIELDS) : '',
      bodyType: 'json',
      auth: 'none' as const,
      authValue: '',
      repeatCount: 1,
    },
  }

  return {
    nodes: [
      { id: 'node-0', ...urlNode },
      { id: 'node-1', ...methodNode },
    ],
    edges: [
      { id: 'edge-0-1', source: 'node-0', target: 'node-1', animated: true },
    ],
  }
}

/* ─── API externa (Gemini / OpenAI) ─── */

async function callExternalAPI(prompt: string): Promise<string> {
  const { provider, apiKey } = useAIStore.getState()

  if (provider === 'gemini' && apiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    )
    const raw = await res.text()
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${raw.slice(0, 200)}`)
    try {
      const data = JSON.parse(raw)
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    } catch {
      throw new Error(`Gemini devolvió HTML. Revisá tu API key o probá con Local: ${raw.slice(0, 200)}`)
    }
  }

  if (provider === 'openai' && apiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] }),
    })
    const raw = await res.text()
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${raw.slice(0, 200)}`)
    try {
      const data = JSON.parse(raw)
      return data.choices?.[0]?.message?.content ?? ''
    } catch {
      throw new Error(`OpenAI devolvió HTML. Revisá tu API key o probá con Local: ${raw.slice(0, 200)}`)
    }
  }

  return ''
}

function extractJson(text: string): string {
  let cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) cleaned = cleaned.slice(start, end + 1)
  return cleaned
}

/* ─── API pública ─── */

export async function generateMockApi(description: string): Promise<{
  name: string
  path: string
  methods: string[]
  fields: { name: string; type: string }[]
  body: string
}> {
  const { provider, apiKey } = useAIStore.getState()

  if ((provider === 'gemini' || provider === 'openai') && apiKey) {
    const prompt =
      `Genera una configuración de API mock en JSON válido.\nDescripción: ${description}\n\n` +
      `Formato exacto (solo JSON):\n{\n  "name": "...",\n  "path": "/...",\n  "methods": ["GET"],\n  "fields": [{"name": "...", "type": "string"}],\n  "body": "{...}"\n}\n\n` +
      `Tipos: string, int, bool. Reglas: name corto, path empieza con /, methods GET/POST/PUT/PATCH/DELETE/UPDATE, fields mínimo 1, body JSON ejemplo.\n\nGenera el JSON:`

    const raw = await callExternalAPI(prompt)
    if (raw) {
      try {
        return JSON.parse(extractJson(raw))
      } catch {
        throw new Error(`La IA externa no generó JSON válido:\n${raw.slice(0, 300)}`)
      }
    }
  }

  return templateMockApi(description)
}

export async function generateFlow(description: string): Promise<{
  nodes: any[]
  edges: any[]
}> {
  const { provider, apiKey } = useAIStore.getState()

  if ((provider === 'gemini' || provider === 'openai') && apiKey) {
    const prompt =
      `Genera un diagrama de flujo de API en JSON.\nDescripción: ${description}\n\n` +
      `Formato:\n{\n  "nodes": [\n    { "type": "url", "position": {"x":0,"y":0}, "data": {"url":"...", "title":"...", "params":[], "headers":[]} },\n    { "type": "method", "position": {"x":300,"y":0}, "data": {"method":"GET", "headers":[], "body":"", "bodyType":"json", "auth":"none", "authValue":"", "repeatCount":1} }\n  ],\n  "edges": [ { "source": "node-0", "target": "node-1", "animated": true } ]\n}\n\n` +
      `Reglas: type "url" o "method", position.x separados ~300px, edges conectan url→method, mínimo 2 nodos.\n\nGenera el JSON:`

    const raw = await callExternalAPI(prompt)
    if (raw) {
      try {
        return JSON.parse(extractJson(raw))
      } catch {
        throw new Error(`La IA externa no generó JSON válido:\n${raw.slice(0, 300)}`)
      }
    }
  }

  return templateFlow(description)
}
