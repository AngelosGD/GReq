import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Logo } from './Logo'
import { useAppStore } from '../store'
import { nodeTypes } from './nodes'
import { edgeTypes } from './edges'
import { useFlowStore } from '../store/flowStore'
import { invoke } from '@tauri-apps/api/core'
import type { HttpMethod } from './nodes/MethodNode'
import { palettes, methodLabels } from '../constants'
import { useExecStore } from '../store/execStore'

type SidebarMode = 'options' | 'nodes'

const initialNodes: Node[] = []
const initialEdges: Edge[] = []

const methodMap: Record<string, HttpMethod> = {
  get: 'GET', post: 'POST', update: 'UPDATE', del: 'DELETE',
}

interface CanvasProps {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: (changes: any) => void
  onEdgesChange: (changes: any) => void
  onConnect: (params: any) => void
  addNodeToCanvas: (type: string, pos?: { x: number; y: number }) => void
  onNodeSelect: (node: Node | null) => void
  onNodeContext: (event: React.MouseEvent, node: Node) => void
}

function Canvas({
  nodes, edges, onNodesChange, onEdgesChange, onConnect,
  addNodeToCanvas, onNodeSelect, onNodeContext,
}: CanvasProps) {
  const { screenToFlowPosition } = useReactFlow()
  const addRef = useRef(addNodeToCanvas)
  addRef.current = addNodeToCanvas

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/reactflow')
      if (!type) return
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      addRef.current(type, position)
    },
    [screenToFlowPosition],
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeSelect(node)
    },
    [onNodeSelect],
  )

  const onPaneClick = useCallback(() => {
    onNodeSelect(null)
  }, [onNodeSelect])

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      onNodeContext(event, node)
    },
    [onNodeContext],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onNodeClick={onNodeClick}
      onNodeContextMenu={handleContextMenu}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={{ type: 'animated' }}
      zoomOnScroll={true}
      zoomOnPinch={true}
      panOnDrag={true}
      fitView
      style={{ width: '100%', height: '100%' }}
    >
      <Background />
    </ReactFlow>
  )
}

export function MainApp() {
  const goToSettings = useAppStore((s) => s.goToSettings)
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('options')
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; node: Node } | null>(null)
  const takeSnapshot = useFlowStore((s) => s.takeSnapshot)
  const undo = useFlowStore((s) => s.undo)
  const redo = useFlowStore((s) => s.redo)
  const canUndo = useFlowStore((s) => s.canUndo)
  const canRedo = useFlowStore((s) => s.canRedo)
  const setNodeData = useCallback((id: string, data: Partial<any>) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)))
  }, [setNodes])

  const setLoading = useExecStore((s) => s.setLoading)
  const setExecuteFn = useExecStore((s) => s.setExecuteFn)

  const executeNode = useCallback(async (nodeId: string) => {
    const methodNode = nodes.find((n) => n.id === nodeId)
    if (!methodNode) return

    setLoading(nodeId, true)

    try {
      const incomingEdges = edges.filter((e) => e.target === nodeId)
      const sourceNode = incomingEdges.length > 0
        ? nodes.find((n) => n.id === incomingEdges[0].source)
        : null

      const sourceData = (sourceNode?.data as any) ?? {}
      const methodData = (methodNode.data as any) ?? {}

      let url = (sourceData.url as string) || ''
      if (!url.startsWith('http://') && !url.startsWith('https://') && url) {
        url = `http://${url}`
      }

      const params = (sourceData.params as { key: string; value: string }[]) ?? []
      if (params.length > 0) {
        const qs = params
          .filter((p) => p.key)
          .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
          .join('&')
        if (qs) {
          url += (url.includes('?') ? '&' : '?') + qs
        }
      }

      const response = await invoke<{
        status: number
        statusText: string
        headers: { key: string; value: string }[]
        body: string
        durationMs: number
      }>('make_request', {
        input: {
          url,
          method: methodData.method ?? 'GET',
          headers: methodData.headers ?? [],
          body: methodData.body ?? '',
          bodyType: methodData.bodyType ?? 'json',
          authType: methodData.auth ?? 'None',
          authValue: methodData.authValue ?? '',
        },
      })

      setNodeData(nodeId, { response })
    } catch (err) {
      setNodeData(nodeId, {
        response: {
          status: 0,
          statusText: 'Error',
          headers: [],
          body: String(err),
          durationMs: 0,
        },
      })
    } finally {
      setLoading(nodeId, false)
    }
  }, [nodes, edges, setNodeData, setLoading])

  useEffect(() => {
    setExecuteFn(executeNode)
    return () => setExecuteFn(null)
  }, [executeNode, setExecuteFn])

  const duplicateNode = useCallback((node: Node) => {
    takeSnapshot(nodes, edges)
    const newId = `node-${Date.now()}`
    const offset = 40
    const newNode = {
      ...JSON.parse(JSON.stringify(node)),
      id: newId,
      position: { x: node.position.x + offset, y: node.position.y + offset },
      selected: false,
    }
    setNodes((nds) => [...nds, newNode])
    setCtxMenu(null)
  }, [nodes, edges, setNodes, takeSnapshot])

  const deleteNode = useCallback((node: Node) => {
    takeSnapshot(nodes, edges)
    setNodes((nds) => nds.filter((n) => n.id !== node.id))
    setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id))
    setSelectedNode((prev) => (prev?.id === node.id ? null : prev))
    setCtxMenu(null)
  }, [setNodes, setEdges, takeSnapshot])

  const addNodeToCanvas = useCallback(
    (type: string, position?: { x: number; y: number }) => {
      takeSnapshot(nodes, edges)
      const viewport = { x: 0, y: 0, zoom: 1 }
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      const center = {
        x: (cx - viewport.x) / viewport.zoom,
        y: (cy - viewport.y) / viewport.zoom,
      }
      const pos = position ?? {
        x: center.x - 85 + Math.random() * 70,
        y: center.y - 25 + Math.random() * 50,
      }
      const id = `node-${Date.now()}`
      if (type === 'url') {
        setNodes((nds) => [...nds, { id, type: 'url', position: pos, data: { url: '', headers: [], params: [] } } as Node])
        return
      }
      const method = methodMap[type]
      if (method) {
        setNodes((nds) => [...nds, { id, type: 'method', position: pos, data: { method, headers: [], body: '', bodyType: 'json', auth: 'None' } } as Node])
      }
    },
    [setNodes, takeSnapshot, nodes, edges],
  )

  const onConnect = useCallback(
    (params: Connection) => {
      takeSnapshot(nodes, edges)
      setEdges((eds) => addEdge({ ...params, type: 'animated' }, eds))
    },
    [setEdges, takeSnapshot, nodes, edges],
  )

  /* Keyboard shortcuts */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const snap = undo()
        if (snap) {
          setNodes(snap.nodes)
          setEdges(snap.edges)
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y') && e.shiftKey) {
        e.preventDefault()
        const snap = redo()
        if (snap) {
          setNodes(snap.nodes)
          setEdges(snap.edges)
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y' && !e.shiftKey) {
        e.preventDefault()
        const snap = redo()
        if (snap) {
          setNodes(snap.nodes)
          setEdges(snap.edges)
        }
        return
      }
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable
      if ((e.key === 'Delete' || e.key === 'Supr' || e.key === 'Backspace') && selectedNode && !isInput) {
        e.preventDefault()
        takeSnapshot(nodes, edges)
        const node = selectedNode
        setNodes((nds) => nds.filter((n) => n.id !== node.id))
        setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id))
        setSelectedNode(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [undo, redo, setNodes, setEdges, selectedNode, nodes, edges, takeSnapshot])

  /* Save flow */
  const saveFlow = useCallback(() => {
    const data = { nodes, edges }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flow-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, edges])

  /* Load flow */
  const loadFlow = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string)
          if (data.nodes) setNodes(data.nodes)
          if (data.edges) setEdges(data.edges)
          takeSnapshot(data.nodes || [], data.edges || [])
        } catch {
          alert('Error al cargar el archivo')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [setNodes, setEdges, takeSnapshot])

  return (
    <ReactFlowProvider>
      <div className="h-[100dvh] flex flex-col bg-white" style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
        <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-200/70 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Logo size={22} className="shrink-0" />
            <span className="text-sm font-bold text-zinc-900 tracking-tight">GReq</span>
            <div className="w-px h-4 bg-zinc-200" />
            <button
              onClick={undo}
              disabled={!canUndo()}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Deshacer (Ctrl+Z)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
            </button>
            <button
              onClick={redo}
              disabled={!canRedo()}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Rehacer (Ctrl+Shift+Z)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
              </svg>
            </button>
            <div className="w-px h-4 bg-zinc-200" />
            <button
              onClick={saveFlow}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
              title="Guardar flujo"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Guardar
            </button>
            <button
              onClick={loadFlow}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
              title="Cargar flujo"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v6m0 0l-3-3m3 3l3-3m-8.25 6a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
              Cargar
            </button>
          </div>
          <button
            onClick={goToSettings}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 active:scale-95 transition-all"
            aria-label="Configuración"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-52 flex-shrink-0 border-r border-zinc-200/70 bg-zinc-50/50 flex flex-col p-2.5 gap-2">
            {sidebarMode === 'options' ? (
              <>
                <button
                  onClick={() => setSidebarMode('nodes')}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-xs font-semibold
                             bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20
                             transition-all active:scale-[0.98]"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Hacer peticiones
                </button>
                <span className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-400 cursor-not-allowed select-none">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  Mandar llamar APIs
                </span>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSidebarMode('options')}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-medium
                             text-zinc-500 hover:bg-zinc-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  Volver
                </button>
                <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.1em] px-1">Nodos</div>
                <NodeCard type="url" onAdd={addNodeToCanvas} />
                <NodeCard type="get" onAdd={addNodeToCanvas} />
                <NodeCard type="post" onAdd={addNodeToCanvas} />
                <NodeCard type="del" onAdd={addNodeToCanvas} />
                <NodeCard type="update" onAdd={addNodeToCanvas} />
              </>
            )}
          </aside>

          <main
            className="flex-1 relative"
            onClick={() => setCtxMenu(null)}
          >
            <Canvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              addNodeToCanvas={addNodeToCanvas}
              onNodeSelect={setSelectedNode}
              onNodeContext={(_e: React.MouseEvent, node: Node) => {
                setSelectedNode(node)
                setCtxMenu({ x: _e.clientX, y: _e.clientY, node })
              }}
            />

            {nodes.length === 0 && !selectedNode && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="text-center max-w-xs pointer-events-auto">
                  <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-emerald-400/10 to-emerald-500/5 border border-emerald-200/50 flex items-center justify-center">
                    <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-zinc-900 mb-2">Get Started</h2>
                  <p className="text-sm text-zinc-500 mb-5 leading-relaxed">
                    Arrastra nodos desde la barra lateral o haz clic en ellos para agregarlos al canvas.
                  </p>
                </div>
              </div>
            )}
          </main>

          {ctxMenu && (
            <ContextMenu
              x={ctxMenu.x}
              y={ctxMenu.y}
              onDuplicate={() => duplicateNode(ctxMenu.node)}
              onDelete={() => deleteNode(ctxMenu.node)}
              onClose={() => setCtxMenu(null)}
            />
          )}

          {selectedNode && (
            <ConfigPanel
              node={selectedNode}
              setNodeData={setNodeData}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </div>
      </div>
    </ReactFlowProvider>
  )
}

function ResponseSection({ node, setNodeData }: { node: Node; setNodeData: (id: string, data: Partial<any>) => void }) {
  const d = (node.data as any) ?? {}
  const res = d.response
  if (!res) return null

  const statusColor =
    res.status >= 200 && res.status < 300 ? 'text-emerald-500'
    : res.status >= 300 && res.status < 400 ? 'text-amber-500'
    : res.status >= 400 ? 'text-red-500'
    : 'text-zinc-500'

  return (
    <div className="space-y-3 border-t border-zinc-100 pt-4">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">Respuesta</label>
        <button
          onClick={() => setNodeData(node.id, { response: undefined })}
          className="text-[9px] text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          Limpiar
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold ${statusColor}`}>
          {res.status}
        </span>
        <span className="text-[10px] text-zinc-500">{res.statusText}</span>
        <span className="text-[9px] text-zinc-400 ml-auto">{res.durationMs}ms</span>
      </div>

      <details className="group">
        <summary className="text-[10px] font-medium text-zinc-500 cursor-pointer hover:text-zinc-700 transition-colors list-none flex items-center gap-1.5">
          <svg className="w-3 h-3 text-zinc-400 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Headers ({res.headers?.length ?? 0})
        </summary>
        <div className="mt-1.5 space-y-0.5 max-h-36 overflow-y-auto">
          {(res.headers as { key: string; value: string }[] ?? []).map((h: any, i: number) => (
            <div key={i} className="flex gap-2 text-[9px] font-mono">
              <span className="text-zinc-500 shrink-0">{h.key}:</span>
              <span className="text-zinc-700 break-all">{h.value}</span>
            </div>
          ))}
        </div>
      </details>

      <div>
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] block mb-1.5">Body</label>
        <pre className="w-full max-h-60 overflow-auto bg-zinc-50 border border-zinc-200/80 rounded-lg px-3 py-2 text-[10px] font-mono text-zinc-700 leading-relaxed whitespace-pre-wrap break-all">
          {res.body}
        </pre>
      </div>
    </div>
  )
}

/* ─── Premium mini node cards ─── */

function NodeCard({ type, onAdd }: { type: string; onAdd: (type: string, pos?: { x: number; y: number }) => void }) {
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
      {isUrl ? (
        <div className="relative bg-white rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] border border-zinc-200/60 overflow-hidden">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/60 to-transparent pointer-events-none" />
          <div
            className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-r-full"
            style={{ background: `linear-gradient(180deg, ${c.from}, ${c.to})` }}
          />
          <div className="relative pl-4 pr-3 py-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot, boxShadow: `0 0 4px ${c.dot}60` }} />
              <span className="text-[7px] font-semibold text-zinc-400/80 uppercase tracking-[0.18em]">URL</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border px-1.5 py-1" style={{ borderColor: 'rgba(0,0,0,0.06)', backgroundColor: 'rgba(244,244,245,0.7)' }}>
              <svg className="w-2.5 h-2.5 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="text-[7px] font-mono text-zinc-400">https://api...</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative bg-white rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] border border-zinc-200/60 overflow-hidden">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/60 to-transparent pointer-events-none" />
          <div
            className="relative h-1.5 w-full"
            style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})`, boxShadow: `0 1px 6px ${c.dot}30` }}
          />
          <div className="relative p-2.5 pt-2">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot, boxShadow: `0 0 4px ${c.dot}60` }} />
              <span className="text-[8px] font-bold uppercase tracking-[0.12em]" style={{ color: c.dot }}>{c.label}</span>
              <span className="text-[7px] text-zinc-400/60 font-medium ml-auto">Solicitud</span>
            </div>
            <div
              className="flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-white text-[8px] font-semibold"
              style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})`, boxShadow: `0 1px 4px ${c.dot}30, inset 0 1px 0 rgba(255,255,255,0.2)` }}
            >
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
              </svg>
              Ejecutar
            </div>
            <div
              className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-[5px] h-[5px] rounded-full border-[1.5px] border-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
            />
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[3px] w-[5px] h-[5px] rounded-full border-[1.5px] border-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Context Menu ─── */

function ContextMenu({ x, y, onDuplicate, onDelete, onClose }: {
  x: number; y: number
  onDuplicate: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 w-40 bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] border border-zinc-200/80 py-1.5 overflow-hidden"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => { onDuplicate(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        Duplicar
      </button>
      <button
        onClick={() => { onDelete(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
        Eliminar
      </button>
    </div>
  )
}

/* ─── Node Config Panel ─── */

function ConfigPanel({ node, setNodeData, onClose }: {
  node: Node
  setNodeData: (id: string, data: Partial<any>) => void
  onClose: () => void
}) {
  const isUrl = node.type === 'url'
  const isMethod = node.type === 'method'

  return (
    <aside className="w-72 flex-shrink-0 border-l border-zinc-200/70 bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isUrl ? 'bg-emerald-400' : 'bg-blue-400'}`} />
          <span className="text-xs font-semibold text-zinc-700 capitalize">
            {node.type === 'url' ? 'URL' : (node.data as any)?.method || 'Method'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isUrl && <UrlConfig node={node} setNodeData={setNodeData} />}
        {isMethod && <MethodConfig node={node} setNodeData={setNodeData} />}
        {(node.data as any)?.response && <ResponseSection node={node} setNodeData={setNodeData} />}
      </div>
    </aside>
  )
}

function KeyValueEditor({ pairs, onChange, keyLabel, valueLabel }: {
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
            className="flex-1 min-w-0 bg-zinc-50 border border-zinc-200/80 rounded-lg px-2 py-1.5 text-[11px] text-zinc-700 outline-none focus:border-emerald-400 transition-all"
          />
          <input
            value={p.value} onChange={(e) => update(i, 'value', e.target.value)}
            placeholder={valueLabel ?? 'Value'}
            className="flex-1 min-w-0 bg-zinc-50 border border-zinc-200/80 rounded-lg px-2 py-1.5 text-[11px] text-zinc-700 outline-none focus:border-emerald-400 transition-all"
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
        className="text-[10px] font-medium text-emerald-500 hover:text-emerald-600 transition-colors"
      >
        + Añadir
      </button>
    </div>
  )
}

function UrlConfig({ node, setNodeData }: { node: Node; setNodeData: (id: string, data: Partial<any>) => void }) {
  const d = (node.data as any) ?? {}
  const [url, setUrl] = useState(d.url ?? '')

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] block mb-1.5">URL</label>
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setNodeData(node.id, { url: e.target.value })
          }}
          placeholder="https://api.ejemplo.com"
          className="w-full bg-zinc-50 border border-zinc-200/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-700 placeholder:text-zinc-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15 transition-all"
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] block mb-1.5">Headers</label>
        <KeyValueEditor
          pairs={d.headers ?? []}
          onChange={(headers) => setNodeData(node.id, { headers })}
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] block mb-1.5">Query Params</label>
        <KeyValueEditor
          pairs={d.params ?? []}
          onChange={(params) => setNodeData(node.id, { params })}
        />
      </div>
    </div>
  )
}

function MethodConfig({ node, setNodeData }: { node: Node; setNodeData: (id: string, data: Partial<any>) => void }) {
  const d = (node.data as any) ?? {}
  const method = d.method as string

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] block mb-1.5">Method</label>
        <div className="flex gap-1">
          {['GET', 'POST', 'DELETE', 'UPDATE'].map((m) => {
            const p = palettes[methodLabels[m] as keyof typeof palettes]
            return (
              <button
                key={m}
                onClick={() => setNodeData(node.id, { method: m })}
                className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  method === m
                    ? 'text-white shadow-sm'
                    : 'text-zinc-400 bg-zinc-50 hover:bg-zinc-100'
                }`}
                style={method === m && p ? {
                  background: `linear-gradient(135deg, ${p.from}, ${p.to})`,
                } : undefined}
              >
                {m}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] block mb-1.5">Headers</label>
        <KeyValueEditor
          pairs={d.headers ?? []}
          onChange={(headers) => setNodeData(node.id, { headers })}
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] block mb-1.5">Body</label>
        <div className="flex gap-1 mb-2">
          {['json', 'text', 'form'].map((t) => (
            <button
              key={t}
              onClick={() => setNodeData(node.id, { bodyType: t })}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-medium uppercase tracking-wider transition-all ${
                (d.bodyType ?? 'json') === t ? 'bg-zinc-800 text-white' : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {(d.bodyType ?? 'json') === 'json' && (
          <textarea
            value={d.body ?? '{\n  \n}'}
            onChange={(e) => setNodeData(node.id, { body: e.target.value })}
            className="w-full h-28 bg-zinc-50 border border-zinc-200/80 rounded-lg px-3 py-2 text-[11px] font-mono text-zinc-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15 transition-all resize-none"
          />
        )}
        {(d.bodyType ?? 'json') === 'text' && (
          <textarea
            value={d.body ?? ''}
            onChange={(e) => setNodeData(node.id, { body: e.target.value })}
            placeholder="Texto plano..."
            className="w-full h-28 bg-zinc-50 border border-zinc-200/80 rounded-lg px-3 py-2 text-[11px] font-mono text-zinc-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15 transition-all resize-none"
          />
        )}
        {(d.bodyType ?? 'json') === 'form' && (
          <KeyValueEditor
            pairs={d.body ? JSON.parse(d.body) : [{ key: '', value: '' }]}
            onChange={(pairs) => setNodeData(node.id, { body: JSON.stringify(pairs) })}
          />
        )}
      </div>

      <div>
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] block mb-1.5">Auth</label>
        <div className="flex gap-1">
          {['None', 'Basic', 'Bearer'].map((a) => (
            <button
              key={a}
              onClick={() => setNodeData(node.id, { auth: a })}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-medium transition-all ${
                (d.auth ?? 'None') === a ? 'bg-zinc-800 text-white' : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        {(d.auth === 'Basic' || d.auth === 'Bearer') && (
          <input
            value={d.authValue ?? ''}
            onChange={(e) => setNodeData(node.id, { authValue: e.target.value })}
            placeholder={d.auth === 'Bearer' ? 'Token' : 'usuario:contraseña'}
            className="w-full bg-zinc-50 border border-zinc-200/80 rounded-lg px-3 py-1.5 text-[11px] font-mono text-zinc-700 outline-none focus:border-emerald-400 transition-all"
          />
        )}
      </div>
    </div>
  )
}
