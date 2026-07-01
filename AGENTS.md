# GReq — Visual Node-Based API Client

## Commands
```bash
npm run dev          # Standalone Vite dev (port 1420, strict)
npm run tauri dev    # Tauri desktop — auto-runs `npm run dev` via beforeDevCommand
npm run build        # tsc + Vite build (typecheck first)
npm run tauri build  # Release — auto-runs `npm run build` via beforeBuildCommand
npm run preview      # Vite preview of built frontend
npm run tauri        # Tauri CLI shortcut
```
No lint, test, or format commands exist.

## Stack
- Frontend: `src/` — React 18 + TypeScript + Vite + TailwindCSS (light-mode only despite `class` dark mode config)
- Backend: `src-tauri/` — Rust crate `api-flow` / lib `api_flow_lib`, Tauri v2. IPC: `make_request`, `start_mock_server`, `stop_mock_server`.
- State: Zustand — 4 stores (`appStore`, `flowStore`, `execStore`, `themeStore`)
- Flow: `@xyflow/react` v12 — 2 node types (`url`, `method`), 1 edge type (`animated`)

## Architecture
- **4 screens** (`appStore.screen`): `onboarding` → `auth` → `main` → `settings`
- **Auth** is a client-side stub — any form submission calls `onSuccess()`. No backend auth.
- **Settings** is empty ("No hay ajustes disponibles.")
- **Theme store** stub: `toggle: () => {}` — dark mode not wired despite `dark:` CSS classes present
- **Sidebar drag keys**: URL uses `'url'`; methods use `'get'`, `'post'`, `'delete'`, `'update'`
- **Node data shapes**: UrlNode `{ url, title, params:[], headers:[] }`; MethodNode `{ method, headers, body, bodyType, auth, authValue }`
- **Request execution**: walks edges backward through URL nodes to find previous method for `$prev` resolution. Execution registered via `execStore.setExecuteFn`.
- **Context menu** (right-click): Duplicate / Delete node
- **Group search**: `NodeSearch` component allows finding URL nodes by title and navigating to them
- **History**: Named groups auto-save to localStorage (`greq-history`, last 20). Save via "Guardar" or when a URL node gets a title. History modal (clock icon in toolbar) shows each group with its connected methods — "Retomar" restores to canvas, "Eliminar" removes from history.
- **Group-aware deletion**: Deleting a named URL node with connected method nodes shows a modal: "Eliminar todo el grupo" (URL + all its methods) or "Eliminar solo el nodo base" (orphan the methods).
- **Mock API panel**: Reemplaza el canvas con split-view (sidebar + detalle). Pestañas múltiples (como navegador), filtro por método + búsqueda por nombre. APIs persistentes en localStorage (`greq-mock-apis`, 20 máximo). Botón "Generar API" en sidebar cambia a verde cuando activo.
- **Onboarding**: 3 slides con media (imágenes y video autoplay loop muted). Navegación centrada con flechas y dots. Texto siempre centrado.

## Variable Syntax
- `{{$prev.body.path.to.field}}` — JSON body path
- `{{$prev.body}}` — full body as string
- `{{$prev.headers.Header-Name}}` — case-insensitive header lookup
- `{{$prev.status}}` — HTTP status code
- `{{$prev.statusText}}` — status text
- `{{nodeId.body.path}}` — explicit node reference

## Backend (Rust) Behavior
### make_request
- Auto-prepends `http://` when no scheme (also done in frontend before invoking)
- 30s hardcoded timeout, duration in ms
- Body types: JSON (auto-parses, falls back to raw), text, form
- Auth: Bearer or Basic (`user:pass`)
- Debug output via `eprintln!` in debug builds only

### start_mock_server
- **Config**: `{ path, method, status, headers, body, port }` — arranca servidor axum en `127.0.0.1:{port}` (o puerto aleatorio si no se especifica)
- **Returns**: `{ url, id }` con la URL real y un ID para detenerlo
- Usa `axum::serve` con `with_graceful_shutdown` via oneshot channel
- Responde a todas las rutas con el status, headers y body configurados

### stop_mock_server
- **Input**: `{ id }` — envía señal de shutdown al servidor
- **Returns**: `()` o error si no existe

### General
- `#[serde(rename_all = "camelCase")]` — JS envía `bodyType`, `authType`, `port`, etc.
- `MockManager` estado global con `Mutex<HashMap<String, ShutdownSender>>`

## Save/Load & Undo
- Saves `{ nodes, edges }` as JSON download; loads via file input (`.json`)
- Snapshot undo/redo (50 max) via `flowStore`, triggered before mutations
- `Ctrl+Z` undo, `Ctrl+Shift+Z` / `Ctrl+Y` redo; `Delete`/`Backspace` removes selected node

## Config Quirks
- `tsconfig.json`: strict, `noUnusedLocals`, `noUnusedParameters`, `skipLibCheck`
- `tauri.conf.json`: `beforeDevCommand: "npm run dev"`, `beforeBuildCommand: "npm run build"`, window 1000×650, CSP disabled
- `src-tauri/capabilities/default.json`: only `core:default` permission
