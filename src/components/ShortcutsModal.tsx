export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 dark:bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl shadow-black/8 dark:shadow-black/40 w-80 p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4">Atajos de teclado</h3>
        <div className="space-y-2.5 text-xs">
          <div className="flex justify-between"><span className="text-zinc-500 dark:text-zinc-400">Deshacer</span><kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">Ctrl+Z</kbd></div>
          <div className="flex justify-between"><span className="text-zinc-500 dark:text-zinc-400">Rehacer</span><kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">Ctrl+Shift+Z</kbd></div>
          <div className="flex justify-between"><span className="text-zinc-500 dark:text-zinc-400">Rehacer</span><kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">Ctrl+Y</kbd></div>
          <div className="flex justify-between"><span className="text-zinc-500 dark:text-zinc-400">Eliminar nodo</span><kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">Supr</kbd></div>
        </div>
        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <button onClick={onClose} className="w-full py-2 rounded-lg text-xs font-semibold bg-zinc-900 dark:bg-zinc-700 text-white hover:bg-zinc-800 dark:hover:bg-zinc-600 transition-all">Cerrar</button>
        </div>
      </div>
    </div>
  )
}