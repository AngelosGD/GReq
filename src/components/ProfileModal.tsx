import { useAuthStore } from '../store/authStore'

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-tinted-lg border border-zinc-200/70 dark:border-zinc-700/70 w-full max-w-xs p-5 screen-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 font-semibold text-sm">
            {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{user?.name || 'Sin nombre'}</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{user?.email || ''}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-[0.98] transition-all duration-150"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
