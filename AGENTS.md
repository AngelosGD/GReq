# GReq — Visual Node-Based API Client

## Stack
- **Desktop:** Tauri v2 (Rust)
- **Frontend:** React 18 + TypeScript + Vite
- **Nodes:** `@xyflow/react`
- **Styles:** TailwindCSS (light mode only)
- **State:** Zustand
- **HTTP:** reqwest (Rust side, `rustls-tls`, no native TLS, JSON enabled)

## Commands
- `npm run dev` — Vite dev server (port 1420, strict port, HMR 1421 when `TAURI_DEV_HOST` is set)
- `npm run tauri dev` — Tauri desktop app (auto-starts Vite)
- `npm run build` — `tsc && vite build` (type-check runs first)
- `npm run tauri build` — Release build
- No test/lint scripts

## Frontend
- **Entrypoint:** `index.html` (lang `es`) → `src/main.tsx`
- **Logo:** 3 connected black dots on white bg (`src/components/Logo.tsx`)
- **Screens:** `onboarding` → `auth` → `main` (appStore `screen`)
- **MainApp:** header (undo/redo, guardar/cargar flujo, buscador de grupos, settings), left sidebar (añadir nodos), right sidebar (config panel), canvas
- **Custom nodes:** UrlNode (input URL + target/source handles), MethodNode (método + botón ejecutar + loading state)
- **Edges:** `AnimatedFlowEdge` con dash animado, botón de borrar al seleccionar
- **Context menu:** right-click → Duplicar / Eliminar
- **Undo/redo:** Ctrl+Z / Ctrl+Shift+Z (historial de 50 snapshots)
- **Save/load:** descarga JSON / carga JSON
- **NodeSearch:** buscador en header que lista URL nodes con nombre, expande métodos conectados, clic centra canvas
- **Styles:** `src/index.css` — Tailwind, scrollbar 6px, fade-in, emerald selection
- **TS strict** with `noUnusedLocals` + `noUnusedParameters`; Vite ignores `src-tauri/**`
- **Constants compartidos:** `src/constants.ts` — paletas de colores, methodLabels

## Rust backend
- `src-tauri/src/lib.rs`: comando `make_request` implementado con reqwest
- Soporta GET/POST/PUT/DELETE, body JSON/text/form, headers, query params, auth Bearer/Basic
- Mide duración en ms
- Timeout 30s, prefijo automático `http://`

## Encadenamiento de requests
- Respuestas guardadas en `execStore.responses` por nodeId
- Sintaxis de variables: `{{$prev.body.path}}`, `{{$prev.headers.Name}}`, `{{$prev.status}}`
- Soporta referencias explícitas: `{{nodeId.body.path}}`
- Resolución recursiva: URL → Method → URL → Method (sigue la cadena de edges)
- UrlNode ahora tiene target handle (izquierda) + source handle (derecha)

## Nombre de grupos
- URL nodes aceptan campo `title` (configurable en panel derecho)
- Se muestra como badge arriba del URL node en el canvas
- NodeSearch los lista para navegación rápida

## Project state
Frontend y backend funcionales. Se pueden hacer requests HTTP reales, encadenar respuestas, navegar por grupos. Próximo: history de requests, JSON tree viewer, entornos con variables, snippets cURL.
