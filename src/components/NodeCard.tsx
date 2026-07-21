import { palettes, type PaletteKey } from '../constants'

export function NodeCard({ type, onAdd }: { type: string; onAdd: (type: string, pos?: { x: number; y: number }) => void }) {
  const c = palettes[type as PaletteKey] ?? { dot: '#10b981', from: '#34d399', to: '#059669', border: 'rgba(16,185,129,0.2)', label: type.toUpperCase() }
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
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-zinc-200/50 dark:border-zinc-700/50 bg-white dark:bg-zinc-900 shadow-tinted hover:shadow-tinted-md hover:border-zinc-300/60 dark:hover:border-zinc-600/60 transition-all duration-150">
        <div className="relative">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: isUrl ? '#10b981' : c.dot }} />
          <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: isUrl ? '#10b981' : c.dot, opacity: 0.2, animationDuration: '3s' }} />
        </div>
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{isUrl ? 'URL' : c.label}</span>
        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 ml-auto">{isUrl ? 'Enlace' : 'Solicitud'}</span>
      </div>
    </div>
  )
}
