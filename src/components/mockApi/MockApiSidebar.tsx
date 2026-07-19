import { FilterMethod, MockApiItem, methods, methodColors } from './types'

interface Props {
  mockApis: MockApiItem[]
  filter: FilterMethod
  search: string
  activeTabApiId: string | null
  onSetFilter: (f: FilterMethod) => void
  onSetSearch: (s: string) => void
  onSelectApi: (id: string) => void
  onTogglePin: (id: string) => void
  onNewApi: () => void
  onClose: () => void
}

export function MockApiSidebar({
  mockApis, filter, search, activeTabApiId,
  onSetFilter, onSetSearch, onSelectApi, onTogglePin, onNewApi, onClose,
}: Props) {
  const filtered = mockApis
    .filter((a) => filter === 'Todas' || a.methods.includes(filter))
    .filter((a) => (a.name ?? '').toLowerCase().includes(search.toLowerCase()))

  return (
    <aside className="w-60 flex-shrink-0 border-r border-zinc-200/60 dark:border-zinc-700/60 flex flex-col">
      <div className="flex items-center justify-between px-4 h-11">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">APIs de prueba</h2>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-3 pb-2 flex gap-1 flex-wrap border-b border-zinc-100 dark:border-zinc-800">
        {(['Todas', ...methods] as const).map((m) => {
          const c = m !== 'Todas' ? methodColors[m] : null
          const act = filter === m
          return (
            <button
              key={m}
              onClick={() => onSetFilter(m)}
              className={`px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1.5 transition-all duration-150 ${act ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
            >
              {c ? (
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full ${act ? 'bg-zinc-800 dark:bg-zinc-200' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
              )}
              {m}
            </button>
          )
        })}
      </div>

      <div className="px-3 pt-2 pb-1">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input value={search} onChange={(e) => onSetSearch(e.target.value)} placeholder="Buscar..." className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg pl-7 pr-2.5 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-300 placeholder-zinc-300 dark:placeholder-zinc-500 outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition-all" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {mockApis.length === 0 ? (
          <div className="text-center py-10 px-4">
            <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center">
              <svg className="w-4 h-4 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">No hay APIs de prueba</p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Crea una desde el botón de abajo</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8"><p className="text-[11px] text-zinc-400 dark:text-zinc-500">Sin resultados</p></div>
        ) : (
          [...filtered].sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1)).map((api) => {
            const isSelected = activeTabApiId === api.id
            return (
              <div key={api.id} className={`w-full px-1.5 py-1.5 rounded-lg transition-all duration-150 flex items-center gap-1 ${isSelected ? 'bg-zinc-100 dark:bg-zinc-800/50' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'}`}>
                <button onClick={() => onTogglePin(api.id)} className="shrink-0 w-4 h-4 flex items-center justify-center">
                  <svg className={`w-3 h-3 ${api.pinned ? 'text-amber-400 fill-amber-400' : 'text-zinc-200 dark:text-zinc-600 hover:text-zinc-400 dark:hover:text-zinc-400'}`} viewBox="0 0 24 24" fill={api.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                </button>
                <button onClick={() => onSelectApi(api.id)} className="flex-1 flex items-center gap-2 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{api.name}</span>
                      <div className="flex gap-0.5 flex-wrap shrink-0">
                        {api.methods.map((m) => {
                          const c = methodColors[m]
                          return <span key={m} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c?.dot ?? '#a1a1aa' }} />
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex gap-1 flex-wrap">
                        {api.methods.map((m) => {
                          const c = methodColors[m]
                          return <span key={m} className="text-[8px] font-medium uppercase tracking-wider" style={{ color: c?.text ?? '#a1a1aa' }}>{m}</span>
                        })}
                      </div>
                    </div>
                    <code className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 truncate">/{api.path}</code>
                  </div>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${api.running ? 'bg-emerald-400' : 'bg-zinc-200 dark:bg-zinc-600'}`} />
                </button>
              </div>
            )
          })
        )}
      </div>

      <div className="px-2 pb-2 border-t border-zinc-100 dark:border-zinc-800 pt-2">
        <button
          onClick={onNewApi}
          className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-[11px] font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] transition-all duration-150"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nueva API
        </button>
      </div>
    </aside>
  )
}
