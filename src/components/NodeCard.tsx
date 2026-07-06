import { palettes } from '../constants'

export function NodeCard({ type, onAdd }: { type: string; onAdd: (type: string, pos?: { x: number; y: number }) => void }) {
  const c = palettes[type as keyof typeof palettes] ?? palettes.get
  const isUrl = type === 'url'

  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/reactflow', type)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={() => onAdd(type)}
      className="cursor-grab active:cursor-grabbing select-none transition-all active:scale-[0.97]"
    >
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-zinc-200/60 bg-white shadow-sm hover:shadow-md hover:border-zinc-300/60 transition-all">
        <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: isUrl ? '#10b981' : c.dot }} />
        <span className="text-xs font-semibold text-zinc-700">{isUrl ? 'URL' : c.label}</span>
        <span className="text-[9px] text-zinc-400 ml-auto">{isUrl ? 'Enlace' : 'Solicitud'}</span>
      </div>
    </div>
  )
}
