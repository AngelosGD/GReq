import { useAuthStore } from '../store/authStore'

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-zinc-200/80 w-full max-w-xs p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-semibold text-sm">
            {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-800">{user?.name || 'Sin nombre'}</p>
            <p className="text-[11px] text-zinc-500">{user?.email || ''}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl text-xs font-medium text-zinc-500 bg-zinc-100 hover:bg-zinc-200 active:scale-[0.98] transition-all"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
