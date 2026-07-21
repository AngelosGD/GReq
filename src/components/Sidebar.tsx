import type { Node } from '@xyflow/react'
import { AuthGuard } from './AuthGuard'
import { NodeCard } from './NodeCard'
import { getUrlData } from '../utils/nodeData'
import { genCollectionId, saveCollections, type Collection } from '../lib/collections'

type SidebarMode = 'options' | 'nodes'

export function Sidebar({
  sidebarMode, setSidebarMode,
  showMockApi, showGithubSection, showEnvPanel, showExportCode,
  setShowHistory, setShowMockApi, setShowGithubSection,
  setShowEnvPanel, setShowExportCode, setShowAiChat,
  addNodeToCanvas, collections, setCollections,
  activeCollection, setActiveCollection,
  focusNode, nodes, setSelectedNode,
}: {
  sidebarMode: SidebarMode
  setSidebarMode: (m: SidebarMode) => void
  showMockApi: boolean
  showGithubSection: boolean
  showEnvPanel: boolean
  showExportCode: boolean
  setShowHistory: (v: boolean) => void
  setShowMockApi: (v: boolean) => void
  setShowGithubSection: (v: boolean) => void
  setShowEnvPanel: (v: boolean) => void
  setShowExportCode: (v: boolean) => void
  setShowAiChat: (v: boolean) => void
  addNodeToCanvas: (type: string, pos?: { x: number; y: number }) => void
  collections: Collection[]
  setCollections: (updater: Collection[] | ((prev: Collection[]) => Collection[])) => void
  activeCollection: string | null
  setActiveCollection: (v: string | null | ((prev: string | null) => string | null)) => void
  focusNode: (nodeId: string) => void
  nodes: Node[]
  setSelectedNode: (n: Node | null) => void
}) {
  return (
    <aside className="w-52 flex-shrink-0 border-r border-zinc-200/60 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 flex flex-col py-2 gap-0.5 transition-colors duration-200">
      {sidebarMode === 'options' ? (
        <>
          <div className="px-3 pb-1.5">
            <div className="relative">
              <button
                onClick={() => { setSidebarMode('nodes'); setShowMockApi(false); setShowGithubSection(false); setShowEnvPanel(false); setShowExportCode(false); }}
                className={`flex items-center gap-2.5 w-full pl-3 pr-2 py-2 rounded-lg text-xs font-medium transition-all active:scale-[0.98] relative ${
                  !showMockApi && !showGithubSection ? 'text-zinc-800 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                {!showMockApi && !showGithubSection && <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-zinc-800 dark:bg-zinc-100" />}
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Hacer peticiones
              </button>
            </div>
          </div>

          <div className="px-3 pb-0.5">
            <AuthGuard label="Inicia sesión para ver el historial">
              <div className="relative">
                <button
                  onClick={() => setShowHistory(true)}
                  className="flex items-center gap-2.5 w-full pl-3 pr-2 py-2 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all active:scale-[0.98]"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Historial
                </button>
              </div>
            </AuthGuard>
          </div>

          <div className="px-3 pb-0.5">
            <AuthGuard label="Inicia sesión para usar APIs mock">
              <div className="relative">
                <button
                  onClick={() => { setShowMockApi(true); setShowGithubSection(false); setShowEnvPanel(false); setShowExportCode(false); setSelectedNode(null); setSidebarMode('options'); }}
                  className={`flex items-center gap-2.5 w-full pl-3 pr-2 py-2 rounded-lg text-xs font-medium transition-all active:scale-[0.98] relative ${
                    showMockApi ? 'text-zinc-800 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  {showMockApi && <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-zinc-800 dark:bg-zinc-100" />}
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Generar API
                </button>
              </div>
            </AuthGuard>
          </div>

          <div className="px-3 pb-0.5">
            <div className="relative">
              <button
                onClick={() => { setShowGithubSection(true); setShowMockApi(false); setShowEnvPanel(false); setShowExportCode(false); setSelectedNode(null); setSidebarMode('options'); }}
                className={`flex items-center gap-2.5 w-full pl-3 pr-2 py-2 rounded-lg text-xs font-medium transition-all active:scale-[0.98] relative ${
                  showGithubSection ? 'text-zinc-800 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                {showGithubSection && <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-zinc-800 dark:bg-zinc-100" />}
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12c0-5.523-4.477-10-10-10z" />
                </svg>
                Desde GitHub
              </button>
            </div>
          </div>

          <div className="px-3 pb-0.5">
            <div className="relative">
              <button
                onClick={() => { setShowEnvPanel(true); setShowMockApi(false); setShowGithubSection(false); setShowExportCode(false); setSelectedNode(null); setSidebarMode('options'); }}
                className={`flex items-center gap-2.5 w-full pl-3 pr-2 py-2 rounded-lg text-xs font-medium transition-all active:scale-[0.98] relative ${
                  showEnvPanel ? 'text-zinc-800 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                {showEnvPanel && <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-zinc-800 dark:bg-zinc-100" />}
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                Entornos
              </button>
            </div>
          </div>

          <div className="px-3 pb-0.5">
            <button
              onClick={() => { setShowExportCode(true); setShowMockApi(false); setShowGithubSection(false); setShowEnvPanel(false); setSelectedNode(null); setSidebarMode('options'); }}
              className={`flex items-center gap-2.5 w-full pl-3 pr-2 py-2 rounded-lg text-xs font-medium transition-all active:scale-[0.98] ${
                showExportCode ? 'text-zinc-800 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              }`}
            >
              {showExportCode && <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-zinc-800 dark:bg-zinc-100" />}
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
              Exportar código
            </button>
          </div>

          <div className="px-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.12em]">Colecciones</span>
              <button onClick={() => {
                const name = prompt('Nombre de la colección:')
                if (name?.trim()) {
                  const newCol: Collection = { id: genCollectionId(), name: name.trim(), nodeIds: [], collapsed: false }
                  setCollections((prev) => { const next = [...prev, newCol]; saveCollections(next); return next })
                }
              }} className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </button>
            </div>
            {collections.length === 0 ? (
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 py-2 text-center">Agrupa tus endpoints en colecciones</p>
            ) : (
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {collections.map((col) => (
                  <div key={col.id}>
                    <button
                      onClick={() => {
                        setActiveCollection((prev) => prev === col.id ? null : col.id)
                        setCollections((prev) => {
                          const next = prev.map((c) => c.id === col.id ? { ...c, collapsed: !c.collapsed } : c)
                          saveCollections(next)
                          return next
                        })
                      }}
                      className={`group flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-[11px] transition-all ${
                        activeCollection === col.id
                          ? 'text-zinc-800 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800'
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <svg className={`w-3 h-3 shrink-0 text-zinc-400 transition-transform ${col.collapsed ? '' : 'rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      <svg className="w-3.5 h-3.5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                      </svg>
                      <span className="truncate flex-1 text-left">{col.name}</span>
                      <span className="text-[9px] text-zinc-400">{col.nodeIds.length}</span>
                      <button onClick={(e) => { e.stopPropagation(); setCollections((prev) => { const next = prev.filter((c) => c.id !== col.id); saveCollections(next); if (activeCollection === col.id) setActiveCollection(null); return next }) }} className="w-4 h-4 flex items-center justify-center rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </button>
                    {!col.collapsed && col.nodeIds.map((nodeId) => {
                      const node = nodes.find((n) => n.id === nodeId)
                      return node ? (
                        <div key={nodeId} onClick={() => focusNode(nodeId)} className="ml-5 pl-2 flex items-center gap-1.5 py-1 text-[10px] text-zinc-400 dark:text-zinc-500 truncate cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          <span className="truncate">{getUrlData(node).title || getUrlData(node).url || 'Sin título'}</span>
                        </div>
                      ) : null
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          <div className="px-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
            <button
              onClick={() => setShowAiChat(true)}
              className="flex items-center gap-2.5 w-full pl-3 pr-2 py-2 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all active:scale-[0.98]"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Asistente IA
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="px-3">
            <button
              onClick={() => setSidebarMode('options')}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Volver
            </button>
          </div>
          <div className="px-3 pt-3 pb-1.5">
            <div className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.12em]">Nodos</div>
          </div>
          <div className="px-3 space-y-1">
            <NodeCard type="url" onAdd={addNodeToCanvas} />
            <NodeCard type="get" onAdd={addNodeToCanvas} />
            <NodeCard type="post" onAdd={addNodeToCanvas} />
            <NodeCard type="put" onAdd={addNodeToCanvas} />
            <NodeCard type="patch" onAdd={addNodeToCanvas} />
            <NodeCard type="delete" onAdd={addNodeToCanvas} />
            <NodeCard type="update" onAdd={addNodeToCanvas} />
          </div>
        </>
      )}
    </aside>
  )
}