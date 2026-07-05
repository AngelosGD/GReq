import { useAIStore } from '../store/aiStore'

let pipeline: any = null
let modelLoadPromise: Promise<any> | null = null

async function loadLocalModel() {
  if (pipeline) return pipeline
  if (modelLoadPromise) return modelLoadPromise

  const store = useAIStore.getState()
  store.setModelLoading(true)
  store.setModelProgress(0)

  modelLoadPromise = (async () => {
    try {
      const { pipeline: p } = await import('@xenova/transformers')
      pipeline = await p('text2text-generation', 'Xenova/LaMini-Flan-T5-783M', {
        progress_callback: (progress: any) => {
          if (progress?.status === 'progress' && typeof progress.progress === 'number') {
            useAIStore.getState().setModelProgress(progress.progress)
          }
        },
      })
    } catch (e) {
      useAIStore.getState().setModelLoading(false)
      throw new Error(`Error descargando modelo IA: ${e}`)
    }
    useAIStore.getState().setModelLoading(false)
    useAIStore.getState().setModelProgress(100)
    return pipeline
  })()

  return modelLoadPromise
}

export async function generateMockApi(description: string): Promise<{
  name: string
  path: string
  methods: string[]
  fields: { name: string; type: string }[]
  body: string
}> {
  const prompt = `Genera una configuración de API mock en JSON válido.
Descripción: ${description}

Formato exacto (solo JSON, sin markdown):
{
  "name": "...",
  "path": "/...",
  "methods": ["GET"],
  "fields": [{"name": "...", "type": "string"}],
  "body": "{...}"
}

Tipos válidos para fields: "string", "int", "bool"
Reglas:
- name: nombre corto en español
- path: empieza con /
- methods: uno o más de GET, POST, DELETE, UPDATE
- fields: campos que tendrá la respuesta, mínimo 1
- body: JSON de ejemplo con los fields

Genera el JSON:`

  return callAI(prompt, true)
}

export async function generateFlow(description: string): Promise<{
  nodes: any[]
  edges: any[]
}> {
  const prompt = `Genera un diagrama de flujo de API en JSON válido.
Descripción: ${description}

Formato exacto (solo JSON, sin markdown):
{
  "nodes": [
    { "type": "url", "position": { "x": 0, "y": 0 }, "data": { "url": "https://...", "title": "...", "params": [], "headers": [] } },
    { "type": "method", "position": { "x": 300, "y": 0 }, "data": { "method": "GET", "headers": [], "body": "", "bodyType": "json", "auth": "none", "authValue": "", "repeatCount": 1 } }
  ],
  "edges": [
    { "source": "node-0", "target": "node-1", "animated": true }
  ]
}

Reglas:
- type: "url" o "method"
- url: usa https://jsonplaceholder.typicode.com si no se especifica dominio
- position.x: nodes en fila, separados ~300px
- Edges conectan url → method
- Genera mínimo 2 nodos (1 url + 1 method)

Genera el JSON:`

  return callAI(prompt, true)
}

function extractJson(text: string): string {
  // remove markdown fences
  let cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '').trim()
  // find first { and last }
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1)
  }
  return cleaned
}

async function callAI<T>(prompt: string, parseJson: boolean): Promise<T> {
  const { provider, apiKey } = useAIStore.getState()

  let text: string

  if (provider === 'local') {
    const model = await loadLocalModel()
    if (typeof model !== 'function') throw new Error('El modelo local no se cargó correctamente')
    let result: any
    try {
      result = await model(prompt, {
        max_new_tokens: 512,
        temperature: 0.3,
        do_sample: false,
      })
    } catch (e) {
      throw new Error(`Error ejecutando modelo IA: ${e}`)
    }
    if (!Array.isArray(result) || !result[0]?.generated_text) {
      throw new Error(`El modelo devolvió una respuesta inesperada:\n${JSON.stringify(result).slice(0, 300)}`)
    }
    text = result[0].generated_text
  } else if (provider === 'gemini' && apiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    )
    const raw = await res.text()
    if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${raw.slice(0, 200)}`)
    try {
      const data = JSON.parse(raw)
      text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    } catch {
      throw new Error(`Gemini devolvió HTML inesperado. Revisá tu API key o cambiá a proveedor Local.\n\nRespuesta:\n${raw.slice(0, 300)}`)
    }
  } else if (provider === 'openai' && apiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] }),
    })
    const raw = await res.text()
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${raw.slice(0, 200)}`)
    try {
      const data = JSON.parse(raw)
      text = data.choices?.[0]?.message?.content ?? ''
    } catch {
      throw new Error(`OpenAI devolvió HTML inesperado. Revisá tu API key o cambiá a proveedor Local.\n\nRespuesta:\n${raw.slice(0, 300)}`)
    }
  } else {
    throw new Error('Selecciona un proveedor de IA o configura una API key')
  }

  if (!parseJson) return text as unknown as T

  const cleaned = extractJson(text)

  try {
    return JSON.parse(cleaned) as T
  } catch {
    throw new Error(
      `La IA no generó JSON válido.\n\nRespuesta:\n${text.slice(0, 500)}`
    )
  }
}
