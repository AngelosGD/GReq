export function KeyValueEditor({ pairs, onChange, keyLabel, valueLabel }: {
  pairs: { key: string; value: string }[]
  onChange: (pairs: { key: string; value: string }[]) => void
  keyLabel?: string
  valueLabel?: string
}) {
  const add = () => onChange([...pairs, { key: '', value: '' }])
  const remove = (i: number) => onChange(pairs.filter((_, idx) => idx !== i))
  const update = (i: number, field: 'key' | 'value', val: string) => {
    onChange(pairs.map((p, idx) => idx === i ? { ...p, [field]: val } : p))
  }

  return (
    <div className="space-y-1.5">
      {pairs.map((p, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <input
            value={p.key} onChange={(e) => update(i, 'key', e.target.value)}
            placeholder={keyLabel ?? 'Key'}
            className="flex-1 min-w-0 bg-zinc-50 border border-zinc-200/70 rounded-lg px-2 py-1.5 text-[11px] text-zinc-700 outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition-all"
          />
          <input
            value={p.value} onChange={(e) => update(i, 'value', e.target.value)}
            placeholder={valueLabel ?? 'Value'}
            className="flex-1 min-w-0 bg-zinc-50 border border-zinc-200/70 rounded-lg px-2 py-1.5 text-[11px] text-zinc-700 outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition-all"
          />
          <button
            onClick={() => remove(i)}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-zinc-300 hover:text-red-400 hover:bg-red-50 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="text-[10px] font-medium text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50 px-2 py-1 rounded-lg transition-colors"
      >
        + Añadir
      </button>
    </div>
  )
}
