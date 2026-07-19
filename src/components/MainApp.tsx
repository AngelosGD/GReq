import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react'
import { Logo } from './Logo'
import { useAppStore } from '../store'
import { useFlowStore } from '../store/flowStore'
import { useUndoRedo } from '../hooks/useUndoRedo'
import { invoke } from '@tauri-apps/api/core'
import type { HttpMethod } from '../types'

import { useExecStore, type StoredResponse } from '../store/execStore'
import { resolveVariables } from '../utils/resolveVariables'
import { getUrlData, getMethodData } from '../utils/nodeData'
import { NodeSearch } from './NodeSearch'
import { MockApi } from './MockApi'
import { Canvas } from './Canvas'
import { NodeCard } from './NodeCard'
import { ContextMenu } from './ContextMenu'
import { ConfigPanel } from './ConfigPanel'
import { AuthGuard } from './AuthGuard'
import { ProfileModal } from './ProfileModal'
import { signOut } from '../lib/appwrite'
import { useAuthStore } from '../store/authStore'
import { saveHistoryEntry } from '../lib/database'
import { HistoryModal } from './HistoryModal'
import { GroupDeleteModal } from './GroupDeleteModal'
import { AiChat } from './AiChat'
import { GitHubSection } from './GitHubSection'
import { EnvPanel } from './EnvPanel'
import { useEnvStore } from '../store/envStore'
import { ExportCodePanel } from './ExportCodePanel'

type SidebarMode = 'options' | 'nodes'

const initialNodes: Node[] = []
const initialEdges: Edge[] = []

const methodMap: Record<string, HttpMethod> = {
  get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE', update: 'UPDATE',
}

export function MainApp() {
  const goToSettings = useAppStore((s) => s.goToSettings)
  const goToAuth = useAppStore((s) => s.goToAuth)
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('options')
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; node: Node } | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showMockApi, setShowMockApi] = useState(false)
  const [groupDeleteInfo, setGroupDeleteInfo] = useState<{ node: Node; methods: Node[] } | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showAiChat, setShowAiChat] = useState(false)
  const [showGithubSection, setShowGithubSection] = useState(false)
  const [showEnvPanel, setShowEnvPanel] = useState(false)
  const [showExportCode, setShowExportCode] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('greq-theme') === 'dark')
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('greq-theme', dark ? 'dark' : 'light')
  }, [dark])
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const takeSnapshot = useFlowStore((s) => s.takeSnapshot)
  const { undo, redo, canUndo, canRedo } = useUndoRedo()
  const setNodeData = useCallback((id: string, data: Record<string, unknown>) => {
    const node = nodes.find((n) => n.id === id)
    if (node && ('title' in data || 'url' in data)) {
      const mergedData = { ...node.data, ...data }
      if (mergedData.title) {
        const methodEdges = edges.filter((e) => e.source === id)
        const methodNodes = methodEdges
          .map((e) => nodes.find((n) => n.id === e.target))
          .filter(Boolean) as Node[]
        const entry = {
          id,
          title: String(mergedData.title || ''),
          url: String(mergedData.url || ''),
          timestamp: Date.now(),
          methodCount: methodNodes.length,
          nodes: [{ ...node, data: mergedData }, ...methodNodes],
          edges: methodEdges,
        }
        const existing: any[] = JSON.parse(localStorage.getItem('greq-history') || '[]')
        const idx = existing.findIndex((h: any) => h.id === id)
        if (idx >= 0) existing[idx] = entry
        else existing.unshift(entry)
        localStorage.setItem('greq-history', JSON.stringify(existing.slice(0, 20)))
        if (user) {
          saveHistoryEntry(user.$id, entry).catch((err) => console.error('[greq] save history:', err))
        }
      }
    }
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)))
  }, [nodes, edges, setNodes])

  const liveSelectedNode = useMemo(
    () => selectedNode ? nodes.find((n) => n.id === selectedNode.id) ?? selectedNode : null,
    [selectedNode, nodes],
  )

  const setLoading = useExecStore((s) => s.setLoading)
  const setExecuteFn = useExecStore((s) => s.setExecuteFn)

  const setResponse = useExecStore((s) => s.setResponse)

  const executeNode = useCallback(async (nodeId: string) => {
    const methodNode = nodes.find((n) => n.id === nodeId)
    if (!methodNode) return

    const methodData = getMethodData(methodNode)
    const repeatCount = methodData.repeatCount ?? 1
    const envVars = Object.fromEntries(useEnvStore.getState().getActiveVars().map((v) => [v.key, v.value]))

    setLoading(nodeId, true)

    try {
      // Walk backwards through edges to find previous method node
      function findPrevMethod(currentId: string): string | undefined {
        const incoming = edges.filter((e) => e.target === currentId)
        for (const e of incoming) {
          const source = nodes.find((n) => n.id === e.source)
          if (source?.type === 'method') return source.id
          if (source?.type === 'url') return findPrevMethod(source.id)
        }
        return undefined
      }
      const prevMethodId = findPrevMethod(nodeId)

      // Collect all response references for variable resolution
      const allResponses = useExecStore.getState().responses

      // Resolve URL from source node
      const methodIncomingEdges = edges.filter((e) => e.target === nodeId)
      const sourceNode = methodIncomingEdges.length > 0
        ? nodes.find((n) => n.id === methodIncomingEdges[0].source)
        : null
      const sourceData = sourceNode ? getUrlData(sourceNode) : {}

      let rawUrl = (sourceData.url as string) || ''
      // Resolve variables first, then add http:// prefix if needed
      let url = resolveVariables(rawUrl, allResponses, prevMethodId, envVars)
      if (!url.startsWith('http://') && !url.startsWith('https://') && url) {
        url = `http://${url}`
      }

      const params = (sourceData.params as { key: string; value: string }[]) ?? []
      if (params.length > 0) {
        const qs = params
          .filter((p) => p.key)
          .map((p) => `${encodeURIComponent(resolveVariables(p.key, allResponses, prevMethodId, envVars))}=${encodeURIComponent(resolveVariables(p.value, allResponses, prevMethodId, envVars))}`)
          .join('&')
        if (qs) {
          url += (url.includes('?') ? '&' : '?') + qs
        }
      }

      const resolvedHeaders = (methodData.headers as { key: string; value: string }[] ?? []).map((h) => ({
        key: resolveVariables(h.key, allResponses, prevMethodId, envVars),
        value: resolveVariables(h.value, allResponses, prevMethodId, envVars),
      }))
      const resolvedBody = resolveVariables(methodData.body ?? '', allResponses, prevMethodId, envVars)
      const resolvedAuthValue = resolveVariables(methodData.authValue ?? '', allResponses, prevMethodId, envVars)

      const allResponsesArr: StoredResponse[] = []

      for (let i = 0; i < repeatCount; i++) {
        const response = await invoke<StoredResponse>('make_request', {
          input: {
            url,
            method: methodData.method ?? 'GET',
            headers: resolvedHeaders,
            body: resolvedBody,
            bodyType: methodData.bodyType ?? 'json',
            authType: methodData.auth ?? 'None',
            authValue: resolvedAuthValue,
          },
        })
        allResponsesArr.push(response)
      }

      const lastResponse = allResponsesArr[allResponsesArr.length - 1]
      setNodeData(nodeId, { response: lastResponse, responses: allResponsesArr })
      setResponse(nodeId, lastResponse)
    } catch (err) {
      const errResp: StoredResponse = {
        status: 0,
        statusText: 'Error',
        headers: [],
        body: String(err),
        durationMs: 0,
      }
      setNodeData(nodeId, { response: errResp })
      setResponse(nodeId, errResp)
    } finally {
      setLoading(nodeId, false)
    }
  }, [nodes, edges, setNodeData, setLoading, setResponse])

  const saveGroupsToHistory = useCallback(() => {
    const urlNodes = nodes.filter((n) => n.type === 'url' && getUrlData(n).title)
    if (urlNodes.length === 0) return
    const existing: any[] = JSON.parse(localStorage.getItem('greq-history') || '[]')
    for (const urlNode of urlNodes) {
      const { title, url } = getUrlData(urlNode)
      if (!title) continue
      const methodEdges = edges.filter((e) => e.source === urlNode.id)
      const methodNodes = methodEdges
        .map((e) => nodes.find((n) => n.id === e.target))
        .filter(Boolean) as Node[]
      const entry = {
        id: urlNode.id,
        title: title || '',
        url: url || '',
        timestamp: Date.now(),
        methodCount: methodNodes.length,
        nodes: [urlNode, ...methodNodes],
        edges: methodEdges,
      }
      const idx = existing.findIndex((h: any) => h.id === urlNode.id)
      if (idx >= 0) existing[idx] = entry
      else existing.unshift(entry)
    }
    localStorage.setItem('greq-history', JSON.stringify(existing.slice(0, 20)))
  }, [nodes, edges])

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

  const performDelete = useCallback((node: Node, deleteGroup = false) => {
    takeSnapshot(nodes, edges)
    if (deleteGroup) {
      const childIds = edges.filter((e) => e.source === node.id).map((e) => e.target)
      setNodes((nds) => nds.filter((n) => n.id !== node.id && !childIds.includes(n.id)))
      setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id && !childIds.includes(e.source)))
    } else {
      setNodes((nds) => nds.filter((n) => n.id !== node.id))
      setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id))
    }
    setSelectedNode(null)
    setCtxMenu(null)
  }, [nodes, edges, setNodes, setEdges, takeSnapshot])

  const deleteNode = useCallback((node: Node) => {
    const title = getUrlData(node).title
    if (node.type === 'url' && title) {
      const methods = edges
        .filter((e) => e.source === node.id)
        .map((e) => nodes.find((n) => n.id === e.target))
        .filter((n) => n?.type === 'method') as Node[]
      if (methods.length > 0) {
        setGroupDeleteInfo({ node, methods })
        return
      }
    }
    performDelete(node, false)
  }, [edges, nodes, performDelete])

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
        setNodes((nds) => [...nds, { id, type: 'method', position: pos, data: { method, headers: [], body: '', bodyType: 'json', auth: 'None', repeatCount: 1 } } as Node])
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

  /* Sync history when edges change for URL nodes with titles */
  const prevEdgeLen = useRef(edges.length)
  useEffect(() => {
    if (edges.length === prevEdgeLen.current) return
    prevEdgeLen.current = edges.length
    for (const urlNode of nodes.filter((n) => n.type === 'url')) {
      const data = getUrlData(urlNode)
      if (!data.title) continue
      const methodEdges = edges.filter((e) => e.source === urlNode.id)
      const methodNodes = methodEdges
        .map((e) => nodes.find((n) => n.id === e.target))
        .filter(Boolean) as Node[]
      const entry = {
        id: urlNode.id,
        title: data.title || '',
        url: String(data.url || ''),
        timestamp: Date.now(),
        methodCount: methodNodes.length,
        nodes: [urlNode, ...methodNodes],
        edges: methodEdges,
      }
      const existing: any[] = JSON.parse(localStorage.getItem('greq-history') || '[]')
      const idx = existing.findIndex((h: any) => h.id === urlNode.id)
      if (idx >= 0) existing[idx] = entry
      else existing.unshift(entry)
      localStorage.setItem('greq-history', JSON.stringify(existing.slice(0, 20)))
      if (user) {
        saveHistoryEntry(user.$id, entry).catch((err) => console.error('[greq] save history:', err))
      }
    }
  }, [nodes, edges, user])

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
        deleteNode(selectedNode)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [undo, redo, setNodes, setEdges, selectedNode, nodes, edges, takeSnapshot, deleteNode])

  /* Save flow */
  const saveFlow = useCallback(() => {
    saveGroupsToHistory()
    const data = { nodes, edges }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flow-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, edges, saveGroupsToHistory])

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
      <div className="h-[100dvh] flex flex-col bg-white dark:bg-zinc-950" style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
        <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-200/70 dark:border-zinc-800/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Logo size={22} className="shrink-0" />
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">GReq</span>
            <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
            <button
              onClick={undo}
              disabled={!canUndo}
              className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Deshacer (Ctrl+Z)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Rehacer (Ctrl+Shift+Z)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
              </svg>
            </button>
            <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
            <button
              onClick={saveFlow}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              title="Guardar flujo"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Guardar
            </button>
            <button
              onClick={loadFlow}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              title="Cargar flujo"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v6m0 0l-3-3m3 3l3-3m-8.25 6a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
              Cargar
            </button>
          </div>
          <AuthGuard label="Inicia sesión para buscar grupos guardados">
            <NodeSearch nodes={nodes} edges={edges} />
          </AuthGuard>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setDark((p) => !p)}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all"
              aria-label="Alternar tema"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                {dark ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                )}
              </svg>
            </button>
            <div className="relative group">
            <button
              onClick={goToSettings}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all"
              aria-label="Configuración"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.431-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {user && (
              <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-zinc-900 rounded-xl shadow-tinted-lg border border-zinc-200/80 dark:border-zinc-700/80 z-30 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="px-3 py-2 text-[11px] text-zinc-500 dark:text-zinc-400 truncate border-b border-zinc-100 dark:border-zinc-700/50">
                  {user.email}
                </div>
                <button
                  onClick={() => setShowProfile(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  Perfil
                </button>
                <button
                  onClick={async () => {
                    await signOut()
                    setUser(null)
                    goToAuth()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Cerrar sesión
                </button>
            </div>
          )}
          </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-52 flex-shrink-0 border-r border-zinc-200/60 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 flex flex-col py-2 gap-0.5">
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
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
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

          <main
            className="flex-1 relative"
            onClick={() => setCtxMenu(null)}
          >
            {showAiChat && (
              <div className="absolute right-0 top-0 bottom-0 z-20">
                <AiChat
                  onApplyFlow={(newNodes, newEdges) => {
                    const updatedNodes = [...nodes, ...newNodes.map((n) => ({ ...n, selected: false } as Node))]
                    const updatedEdges = [...edges, ...newEdges]
                    setNodes(updatedNodes)
                    setEdges(updatedEdges)
                    takeSnapshot(updatedNodes, updatedEdges)
                  }}
                  onClose={() => setShowAiChat(false)}
                />
              </div>
            )}



            {showEnvPanel && (
              <div className="absolute right-0 top-0 bottom-0 z-20 w-80">
                <EnvPanel onClose={() => setShowEnvPanel(false)} />
              </div>
            )}

            {showExportCode && (
              <div className="absolute right-0 top-0 bottom-0 z-20 w-80">
                <ExportCodePanel
                  nodes={nodes}
                  edges={edges}
                  onClose={() => setShowExportCode(false)}
                />
              </div>
            )}

            {showGithubSection ? (
              <GitHubSection
                onClose={() => setShowGithubSection(false)}
                onImport={(endpoints) => {
                  const newNodes = endpoints.flatMap((ep, i) => {
                    const baseX = i * 400
                    return [
                      {
                        id: `gh-url-${i}`,
                        type: 'url',
                        position: { x: baseX, y: 0 },
                        data: {
                          url: `https://api.example.com${ep.path}`,
                          title: ep.summary || ep.path,
                          params: [],
                          headers: [],
                        },
                      } as Node,
                      {
                        id: `gh-method-${i}`,
                        type: 'method',
                        position: { x: baseX + 300, y: 0 },
                        data: {
                          method: ep.method,
                          headers: [],
                          body: '',
                          bodyType: 'json',
                          auth: 'none',
                          authValue: '',
                          repeatCount: 1,
                        },
                      } as Node,
                    ]
                  })
                  const newEdges: Edge[] = endpoints.map((_, i) => ({
                    id: `gh-edge-${i}`,
                    source: `gh-url-${i}`,
                    target: `gh-method-${i}`,
                    animated: true,
                  }))
                  const allNodes = [...nodes, ...newNodes]
                  const allEdges = [...edges, ...newEdges]
                  setNodes(allNodes)
                  setEdges(allEdges)
                  takeSnapshot(allNodes, allEdges)
                  setShowGithubSection(false)
                }}
              />
            ) : showMockApi ? (
              <MockApi
                onClose={() => setShowMockApi(false)}
                onTestInCanvas={(api) => {
                  const url = `http://localhost:${api.port}/${api.path}`
                  const urlNode: Node = {
                    id: `mock-url-${Date.now()}`,
                    type: 'url',
                    position: { x: 100, y: 100 + Math.random() * 200 },
                    data: { url, title: api.name, params: [], headers: [] },
                  }
                  const methodNode: Node = {
                    id: `mock-method-${Date.now()}`,
                    type: 'method',
                    position: { x: 400, y: 100 + Math.random() * 200 },
                    data: { method: api.methods[0] || 'GET', headers: [], body: '', bodyType: 'json', auth: 'None', authValue: '', repeatCount: 1 },
                  }
                  setNodes((nds) => [...nds, urlNode as Node, methodNode as Node])
                  setEdges((eds) => [...eds, { id: `mock-edge-${Date.now()}`, source: urlNode.id, target: methodNode.id, animated: true }])
                  takeSnapshot(nodes, edges)
                  setShowMockApi(false)
                }}
              />
            ) : (
              <>
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
                  <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-emerald-400/10 to-emerald-500/5 border border-emerald-200/50 dark:border-emerald-800/30 flex items-center justify-center">
                    <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Get Started</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5 leading-relaxed">
                    Arrastra nodos desde la barra lateral o haz clic en ellos para agregarlos al canvas.
                  </p>
                </div>
              </div>
            )}
              </>
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

          {liveSelectedNode && (
            <ConfigPanel
              node={liveSelectedNode}
              setNodeData={setNodeData}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </div>
      </div>

      {showHistory && (
        <HistoryModal
          onClose={() => setShowHistory(false)}
          onRetomar={(entry) => {
            setNodes((nds) => [...nds, ...entry.nodes.map((n) => ({ ...n, selected: false } as Node))])
            setEdges((eds) => [...eds, ...entry.edges])
            setShowHistory(false)
          }}
        />
      )}

      {groupDeleteInfo && (
        <GroupDeleteModal
          node={groupDeleteInfo.node}
          methods={groupDeleteInfo.methods}
          onDeleteGroup={() => {
            performDelete(groupDeleteInfo.node, true)
            setGroupDeleteInfo(null)
          }}
          onDeleteNode={() => {
            performDelete(groupDeleteInfo.node, false)
            setGroupDeleteInfo(null)
          }}
          onCancel={() => setGroupDeleteInfo(null)}
        />
      )}

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </ReactFlowProvider>
  )
}


