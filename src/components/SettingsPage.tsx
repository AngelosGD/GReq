import { useAppStore } from '../store'
import { Logo } from './Logo'

export function SettingsPage() {
  const goBack = useAppStore((s) => s.goBack)

  return (
    <div className="h-[100dvh] flex flex-col bg-white transition-colors duration-300">
      <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={goBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-zinc-400 hover:text-zinc-600
                       hover:bg-zinc-100 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="w-px h-5 bg-zinc-200" />
          <Logo size={22} className="shrink-0" />
          <span className="text-sm font-bold text-zinc-900 tracking-tight">GReq</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full">
        <h1 className="text-xl font-bold text-zinc-900 mb-8">Configuración</h1>

        <div className="space-y-6">
          <p className="text-sm text-zinc-400">No hay ajustes disponibles.</p>
        </div>
      </div>
    </div>
  )
}
