import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
} from '@xyflow/react'
import { useAppStore } from '../store'
import { useFlowStore } from '../store/flowStore'
import { useUndoRedo } from '../hooks/useUndoRedo'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { invokeWithTimeout } from '../lib/tauri'
import type { HttpMethod } from '../types'

import { useExecStore, type StoredResponse } from '../store/execStore'
import { resolveVariables } from '../utils/resolveVariables'
import { getUrlData, getMethodData } from '../utils/nodeData'
import { MockApi } from './MockApi'
import { genId, randomPort } from './mockApi/types'
import type { MockApiItem } from './mockApi/types'
import { Canvas } from './Canvas'
import { ContextMenu } from './ContextMenu'
import { ConfigPanel } from './ConfigPanel'
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
import { loadCollections, saveCollections, type Collection } from '../lib/collections'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { ShortcutsModal } from './ShortcutsModal'

type SidebarMode = 'options' | 'nodes'

const initialNodes: Node[] = []
const initialEdges: Edge[] = []

function loadLocalHistory<T = Record<string, unknown>>(): T[] {
  try {
    return JSON.parse(localStorage.getItem('greq-history') || '[]')
  } catch {
    return []
  }
}

const methodMap: Record<string, HttpMethod> = {
  get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE', update: 'UPDATE',
}

export function MainApp() {
  const goToSettings = useAppStore((s) => s.goToSettings)
  const goToAuth = useAppStore((s) => s.goToAuth)
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('options')
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const wrappedOnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const lockedIds = new Set(
        nodes.filter((n) => (n.data as Record<string, unknown>)?.locked).map((n) => n.id)
      )
      const filtered = changes.filter((c) => {
        if ('id' in c && lockedIds.has(c.id)) {
          return c.type !== 'position' && c.type !== 'dimensions' && c.type !== 'remove'
        }
        return true
      })
      onNodesChange(filtered)
    },
    [nodes, onNodesChange],
  )
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
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [collections, setCollections] = useState<Collection[]>(() => loadCollections())
  const [activeCollection, setActiveCollection] = useState<string | null>(null)
  const [dark, setDark] = useState(() => localStorage.getItem('greq-theme') === 'dark')
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('greq-theme', dark ? 'dark' : 'light')
  }, [dark])
  useEffect(() => {
    const nodeIds = new Set(nodes.map((n) => n.id))
    setCollections((prev) => {
      let changed = false
      const next = prev.map((c) => {
        const filtered = c.nodeIds.filter((id) => nodeIds.has(id))
        if (filtered.length !== c.nodeIds.length) changed = true
        return { ...c, nodeIds: filtered }
      })
      if (changed) saveCollections(next)
      return changed ? next : prev
    })
  }, [nodes.length])
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
        const existing = loadLocalHistory()
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
        const response = await invokeWithTimeout<StoredResponse>('make_request', {
          input: {
            url,
            method: methodData.method ?? 'GET',
            headers: resolvedHeaders,
            body: resolvedBody,
            bodyType: methodData.bodyType ?? 'json',
            authType: methodData.auth ?? 'None',
            authValue: resolvedAuthValue,
          },
        }, 35000)
        allResponsesArr.push(response)
      }

      const lastResponse = allResponsesArr[allResponsesArr.length - 1]
      setNodeData(nodeId, { response: lastResponse, responses: allResponsesArr })
      setResponse(nodeId, lastResponse)
      useExecStore.getState().pushToHistory(nodeId, lastResponse)
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
      useExecStore.getState().pushToHistory(nodeId, errResp)
    } finally {
      setLoading(nodeId, false)
    }
  }, [nodes, edges, setNodeData, setLoading, setResponse])

  const saveGroupsToHistory = useCallback(() => {
    const urlNodes = nodes.filter((n) => n.type === 'url' && getUrlData(n).title)
    if (urlNodes.length === 0) return
    const existing = loadLocalHistory()
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
    let removedIds: string[]
    if (deleteGroup) {
      const childIds = edges.filter((e) => e.source === node.id).map((e) => e.target)
      removedIds = [node.id, ...childIds]
      setNodes((nds) => nds.filter((n) => !removedIds.includes(n.id)))
      setEdges((eds) => eds.filter((e) => !removedIds.includes(e.source) && !removedIds.includes(e.target)))
    } else {
      removedIds = [node.id]
      setNodes((nds) => nds.filter((n) => n.id !== node.id))
      setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id))
    }
    setCollections((prev) => {
      const next = prev.map((c) => ({ ...c, nodeIds: c.nodeIds.filter((id) => !removedIds.includes(id)) }))
      saveCollections(next)
      return next
    })
    setSelectedNode(null)
    setCtxMenu(null)
  }, [nodes, edges, setNodes, setEdges, takeSnapshot])

  const deleteNode = useCallback((node: Node) => {
    if ((node.data as Record<string, unknown>)?.locked) return
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
      const existing = loadLocalHistory()
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
  useKeyboardShortcuts({
    undo, redo, setNodes, setEdges,
    selectedNode, deleteNode,
  })

  /* Save flow */
  const saveFlow = useCallback(() => {
    saveGroupsToHistory()
    const data = { nodes, edges }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flow-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
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

  const focusNodeRef = useRef<((nodeId: string) => void) | null>(null)

  const focusNode = useCallback((nodeId: string) => {
    focusNodeRef.current?.(nodeId)
  }, [])

  const autoLayout = useCallback(() => {
    takeSnapshot(nodes, edges)
    const urlNodes = nodes.filter((n) => n.type === 'url')
    const methodNodes = nodes.filter((n) => n.type === 'method')
    const xSpacing = 350
    const ySpacing = 120
    const startY = 60
    const urlUpdates = urlNodes.map((n, i) => ({
      id: n.id,
      position: { x: 80, y: startY + i * ySpacing * Math.max(1, Math.ceil(methodNodes.length / Math.max(1, urlNodes.length))) }
    }))
    const methodUpdates = methodNodes.map((n) => {
      const connectedEdge = edges.find((e) => e.target === n.id)
      const sourceUrl = connectedEdge ? urlNodes.find((u) => u.id === connectedEdge.source) : undefined
      const sourceIdx = sourceUrl ? urlNodes.indexOf(sourceUrl) : 0
      return {
        id: n.id,
        position: { x: 80 + xSpacing, y: startY + sourceIdx * ySpacing * Math.max(1, Math.ceil(methodNodes.length / Math.max(1, urlNodes.length))) + (methodNodes.indexOf(n) * ySpacing) % (ySpacing * 3) }
      }
    })
    setNodes((nds) => nds.map((n) => {
      const update = [...urlUpdates, ...methodUpdates].find((u) => u.id === n.id)
      return update ? { ...n, position: update.position } : n
    }))
  }, [nodes, edges, setNodes, takeSnapshot])

  const toggleEnvPanel = useCallback(() => setShowEnvPanel((v) => !v), [])

  const handleNodeContext = useCallback(
    (e: React.MouseEvent, node: Node) => {
      setSelectedNode(node)
      setCtxMenu({ x: e.clientX, y: e.clientY, node })
    },
    [],
  )

  const onSignOut = useCallback(async () => {
    await signOut()
    localStorage.removeItem('greq-github-token')
    setUser(null)
    goToAuth()
  }, [setUser, goToAuth])

  return (
    <ReactFlowProvider>
      <div className="h-[100dvh] flex flex-col bg-white dark:bg-zinc-950 transition-colors duration-200" style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
        <TopBar
          undo={undo}
          redo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          saveFlow={saveFlow}
          loadFlow={loadFlow}
          autoLayout={autoLayout}
          dark={dark}
          setDark={setDark}
          goToSettings={goToSettings}
          user={user}
          onSignOut={onSignOut}
          setShowProfile={setShowProfile}
          setShowShortcuts={setShowShortcuts}
          onToggleEnvPanel={toggleEnvPanel}
          nodes={nodes}
          edges={edges}
        />

        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            sidebarMode={sidebarMode}
            setSidebarMode={setSidebarMode}
            showMockApi={showMockApi}
            showGithubSection={showGithubSection}
            showEnvPanel={showEnvPanel}
            showExportCode={showExportCode}
            setShowHistory={setShowHistory}
            setShowMockApi={setShowMockApi}
            setShowGithubSection={setShowGithubSection}
            setShowEnvPanel={setShowEnvPanel}
            setShowExportCode={setShowExportCode}
            setShowAiChat={setShowAiChat}
            addNodeToCanvas={addNodeToCanvas}
            collections={collections}
            setCollections={setCollections}
            activeCollection={activeCollection}
            setActiveCollection={setActiveCollection}
            focusNode={focusNode}
            nodes={nodes}
            setSelectedNode={setSelectedNode}
          />

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
                onCreateMockApi={(endpoints) => {
                  const raw = localStorage.getItem('greq-mock-apis')
                  const existing: MockApiItem[] = raw ? JSON.parse(raw) : []
                  const newApis = endpoints.map((ep) => ({
                    id: genId(),
                    name: ep.summary || `${ep.method} ${ep.path}`,
                    methods: [ep.method],
                    path: ep.path.replace(/^\//, ''),
                    port: randomPort(),
                    running: false,
                    serverId: null,
                    statusCode: 200,
                    responseBody: JSON.stringify({ id: 1, name: 'ejemplo' }, null, 2),
                    responseHeaders: [],
                    delayMs: 0,
                    methodBodies: {},
                    fields: (ep.params || []).map((p) => ({ name: p.name, type: 'string' })),
                    sampleData: [],
                    pinned: false,
                  }))
                  const merged = [...newApis, ...existing].slice(0, 20)
                  localStorage.setItem('greq-mock-apis', JSON.stringify(merged))
                  setShowGithubSection(false)
                  setShowMockApi(true)
                }}
                onImport={(endpoints) => {
                  const newNodes = endpoints.flatMap((ep, i) => {
                    const baseX = i * 400
                    const fullUrl = `${ep.baseUrl || 'https://api.example.com'}${ep.path}`
                    const kv = (h: { name: string; value: string }[]) => h.map(x => ({ key: x.name, value: x.value }))
                    return [
                      {
                        id: `gh-url-${i}`,
                        type: 'url',
                        position: { x: baseX, y: 0 },
                        data: {
                          url: fullUrl,
                          title: ep.summary || ep.path,
                          params: kv(ep.params?.filter(p => p.in === 'query').map(p => ({ name: p.name, value: '' })) || []),
                          headers: kv(ep.headers || []),
                        },
                      } as Node,
                      {
                        id: `gh-method-${i}`,
                        type: 'method',
                        position: { x: baseX + 300, y: 0 },
                        data: {
                          method: ep.method,
                          headers: kv(ep.headers || []),
                          body: ep.body || '',
                          bodyType: ep.contentType === 'application/json' ? 'json' : 'text',
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
                  onNodesChange={wrappedOnNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  addNodeToCanvas={addNodeToCanvas}
                  onNodeSelect={setSelectedNode}
                  onNodeContext={handleNodeContext}
                  focusNodeRef={focusNodeRef}
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
              nodeId={ctxMenu.node.id}
              locked={!!(ctxMenu.node.data as Record<string, unknown>)?.locked}
              onToggleLock={() => setNodeData(ctxMenu.node.id, { locked: !(ctxMenu.node.data as Record<string, unknown>)?.locked })}
              collections={collections}
              onDuplicate={() => duplicateNode(ctxMenu.node)}
              onDelete={() => deleteNode(ctxMenu.node)}
              onAddToCollection={(collectionId, nodeId) => {
                setCollections((prev) => {
                  const next = prev.map((c) =>
                    c.id === collectionId && !c.nodeIds.includes(nodeId)
                      ? { ...c, nodeIds: [...c.nodeIds, nodeId] }
                      : c
                  )
                  saveCollections(next)
                  return next
                })
              }}
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

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </ReactFlowProvider>
  )
}