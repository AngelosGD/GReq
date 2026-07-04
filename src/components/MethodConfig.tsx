import type { Node } from '@xyflow/react'
import { palettes, methodLabels } from '../constants'
import { KeyValueEditor } from './KeyValueEditor'

export function MethodConfig({ node, setNodeData }: { node: Node; setNodeData: (id: string, data: Record<string, unknown>) => void }) {
  const d = (node.data as Record<string, unknown>) ?? {}
  const method = d.method as string

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] block mb-1.5">Method</label>
        <div className="flex gap-1">
          {['GET', 'POST', 'DELETE', 'UPDATE'].map((m) => {
            const p = palettes[methodLabels[m] as keyof typeof palettes]
            return (
              <button
                key={m}
                onClick={() => setNodeData(node.id, { method: m })}
                className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  method === m
                    ? 'text-white shadow-sm'
                    : 'text-zinc-400 bg-zinc-50 hover:bg-zinc-100'
                }`}
                style={method === m && p ? {
                  background: `linear-gradient(135deg, ${p.from}, ${p.to})`,
                } : undefined}
              >
                {m}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] block mb-1.5">Repetir</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={99}
            value={(d.repeatCount as number) ?? 1}
            onChange={(e) => setNodeData(node.id, { repeatCount: parseInt(e.target.value) || 1 })}
            className="w-14 bg-zinc-50 border border-zinc-200/80 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-zinc-700 outline-none focus:border-emerald-400 transition-all"
          />
          <span className="text-[10px] text-zinc-400">veces</span>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] block mb-1.5">Headers</label>
        <KeyValueEditor
          pairs={(d.headers as { key: string; value: string }[]) ?? []}
          onChange={(headers) => setNodeData(node.id, { headers })}
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] block mb-1.5">Body</label>
        <div className="flex gap-1 mb-2">
          {['json', 'text', 'form'].map((t) => (
            <button
              key={t}
              onClick={() => setNodeData(node.id, { bodyType: t })}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-medium uppercase tracking-wider transition-all ${
                (d.bodyType ?? 'json') === t ? 'bg-zinc-800 text-white' : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {(d.bodyType ?? 'json') === 'json' && (
          <textarea
            value={(d.body as string) ?? '{\n  \n}'}
            onChange={(e) => setNodeData(node.id, { body: e.target.value })}
            className="w-full h-28 bg-zinc-50 border border-zinc-200/80 rounded-lg px-3 py-2 text-[11px] font-mono text-zinc-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15 transition-all resize-none"
          />
        )}
        {(d.bodyType ?? 'json') === 'text' && (
          <textarea
            value={(d.body as string) ?? ''}
            onChange={(e) => setNodeData(node.id, { body: e.target.value })}
            placeholder="Texto plano..."
            className="w-full h-28 bg-zinc-50 border border-zinc-200/80 rounded-lg px-3 py-2 text-[11px] font-mono text-zinc-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15 transition-all resize-none"
          />
        )}
        {(d.bodyType ?? 'json') === 'form' && (
          <KeyValueEditor
            pairs={d.body ? JSON.parse(d.body as string) : [{ key: '', value: '' }]}
            onChange={(pairs) => setNodeData(node.id, { body: JSON.stringify(pairs) })}
          />
        )}
      </div>

      <div>
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] block mb-1.5">Auth</label>
        <div className="flex gap-1">
          {['None', 'Basic', 'Bearer'].map((a) => (
            <button
              key={a}
              onClick={() => setNodeData(node.id, { auth: a })}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-medium transition-all ${
                (d.auth ?? 'None') === a ? 'bg-zinc-800 text-white' : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        {(d.auth === 'Basic' || d.auth === 'Bearer') && (
          <input
            value={(d.authValue as string) ?? ''}
            onChange={(e) => setNodeData(node.id, { authValue: e.target.value })}
            placeholder={d.auth === 'Bearer' ? 'Token' : 'usuario:contraseña'}
            className="w-full bg-zinc-50 border border-zinc-200/80 rounded-lg px-3 py-1.5 text-[11px] font-mono text-zinc-700 outline-none focus:border-emerald-400 transition-all"
          />
        )}
      </div>
    </div>
  )
}
