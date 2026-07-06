import type { Node } from '@xyflow/react'
import { KeyValueEditor } from './KeyValueEditor'

const methodDots: Record<string, string> = {
  GET: '#10b981', POST: '#3b82f6', DELETE: '#ef4444', UPDATE: '#f59e0b',
}

export function MethodConfig({ node, setNodeData }: { node: Node; setNodeData: (id: string, data: Record<string, unknown>) => void }) {
  const d = (node.data as Record<string, unknown>) ?? {}
  const method = d.method as string

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] block mb-1.5">Method</label>
        <div className="flex gap-0.5">
          {['GET', 'POST', 'DELETE', 'UPDATE'].map((m) => {
            const active = method === m
            return (
              <button
                key={m}
                onClick={() => setNodeData(node.id, { method: m })}
                className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 ${
                  active
                    ? 'bg-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-600 border-transparent'
                }`}
                style={active ? { borderBottomColor: methodDots[m], color: methodDots[m] } : undefined}
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
            className="w-14 bg-zinc-50 border border-zinc-200/70 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-zinc-700 outline-none focus:border-zinc-300 transition-all"
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
                (d.bodyType ?? 'json') === t ? 'bg-zinc-100 text-zinc-700' : 'text-zinc-400 hover:text-zinc-600'
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
            className="w-full h-28 bg-zinc-50 border border-zinc-200/70 rounded-lg px-3 py-2 text-[11px] font-mono text-zinc-700 outline-none focus:border-zinc-300 transition-all resize-none"
          />
        )}
        {(d.bodyType ?? 'json') === 'text' && (
          <textarea
            value={(d.body as string) ?? ''}
            onChange={(e) => setNodeData(node.id, { body: e.target.value })}
            placeholder="Texto plano..."
            className="w-full h-28 bg-zinc-50 border border-zinc-200/70 rounded-lg px-3 py-2 text-[11px] font-mono text-zinc-700 outline-none focus:border-zinc-300 transition-all resize-none"
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
                (d.auth ?? 'None') === a ? 'bg-zinc-100 text-zinc-700' : 'text-zinc-400 hover:text-zinc-600'
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
            className="w-full bg-zinc-50 border border-zinc-200/70 rounded-lg px-3 py-1.5 text-[11px] font-mono text-zinc-700 outline-none focus:border-zinc-300 transition-all"
          />
        )}
      </div>
    </div>
  )
}
