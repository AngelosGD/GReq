import { useAppStore } from '../store'
import { Logo } from './Logo'
import { useAIStore } from '../store/aiStore'

export function SettingsPage() {
  const goBack = useAppStore((s) => s.goBack)
  const { provider, apiKey, setProvider, setApiKey, modelLoading, modelProgress } = useAIStore()

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

        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-zinc-800 mb-3">Inteligencia Artificial</h2>
            <p className="text-xs text-zinc-400 mb-4">
              El modelo local funciona sin conexión ni API key. Si querés respuestas de mayor calidad,
              conectá una API key externa.
            </p>

            <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Proveedor</label>
            <div className="flex gap-2 mb-4">
              {(['local', 'gemini', 'openai'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    provider === p
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                  }`}
                >
                  {p === 'local' ? 'Local' : p === 'gemini' ? 'Gemini' : 'OpenAI'}
                </button>
              ))}
            </div>

            {provider !== 'local' && (
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">
                  API Key
                  <span className="text-zinc-300 font-normal ml-1">
                    (solo en localStorage, no se envía a ningún servidor)
                  </span>
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    provider === 'gemini'
                      ? 'AIza...'
                      : 'sk-...'
                  }
                  className="w-full bg-zinc-50 border border-zinc-200/50 rounded-lg px-3 py-2 text-xs text-zinc-700 placeholder-zinc-300 outline-none focus:border-zinc-400 transition-all"
                />
              </div>
            )}

            {provider === 'local' && modelLoading && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-400">Descargando modelo IA...</span>
                  <span className="text-xs text-zinc-400">{Math.round(modelProgress)}%</span>
                </div>
                <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-900 rounded-full transition-all duration-300"
                    style={{ width: `${modelProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-300 mt-1">
                  Solo la primera vez (~300 MB). Se cachea para usos futuros.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
