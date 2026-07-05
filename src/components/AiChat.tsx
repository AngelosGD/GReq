import { useState } from 'react'
import { generateFlow } from '../lib/ai'
import type { Node, Edge } from '@xyflow/react'

interface Props {
  onApplyFlow: (nodes: Node[], edges: Edge[]) => void
  onClose: () => void
}

export function AiChat({ onApplyFlow, onClose }: Props) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    { role: 'assistant', text: 'Describí el flujo de API que querés crear. Ej: "Una API que obtiene usuarios y luego actualiza cada uno"' },
  ])
  const [lastResult, setLastResult] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null)

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    setLoading(true)

    try {
      const result = await generateFlow(text)
      setLastResult(result)
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: `✅ Generado: ${result.nodes.length} nodos, ${result.edges.length} conexiones.` },
      ])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: `Error: ${e}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-72 bg-white border-l border-zinc-200/70 flex flex-col">
      <div className="flex items-center justify-between px-4 h-10 border-b border-zinc-100">
        <h3 className="text-[11px] font-semibold text-zinc-700">🤖 Asistente IA</h3>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`text-[11px] leading-relaxed ${msg.role === 'user' ? 'text-zinc-800 text-right' : 'text-zinc-600'}`}>
            <div className={`inline-block rounded-lg px-3 py-2 ${msg.role === 'user' ? 'bg-emerald-500/10 text-emerald-800' : 'bg-zinc-100 text-zinc-700'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-[11px] text-zinc-400 flex items-center gap-2">
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generando...
          </div>
        )}
      </div>

      {lastResult && (
        <div className="px-3 pb-2">
          <button
            onClick={() => { onApplyFlow(lastResult.nodes, lastResult.edges); setLastResult(null); setMessages([{ role: 'assistant', text: '✅ Flujo aplicado al canvas.' }]) }}
            className="w-full py-2 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
          >
            Aplicar al canvas
          </button>
        </div>
      )}

      <div className="border-t border-zinc-100 p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
          placeholder="Describí el flujo..."
          className="flex-1 bg-zinc-50 border border-zinc-200/60 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-700 outline-none focus:border-zinc-300 transition-all placeholder-zinc-300"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
