# GReq — Visual Node-Based API Client

## Commands
```bash
npm run dev          # Vite dev server (port 1420, strictPort)
npm run tauri dev    # Tauri dev — auto-runs `npm run dev` via beforeDevCommand
npm run build        # tsc && vite build (typecheck first)
npm run tauri build  # Release build — auto-runs `npm run build` via beforeBuildCommand
```
No lint, test, format, or codegen commands exist. `tsconfig.json` has `noUnusedLocals` + `noUnusedParameters` — `tsc` will fail on unused imports.

## Stack & Architecture
- **Frontend** (`src/`): React 18 + TS + Vite + TailwindCSS 3. Font: Geist (Google Fonts in `index.html`).
- **Backend** (`src-tauri/`): Rust crate `api-flow`, Cargo lib `api_flow_lib`. Tauri v2 + axum (mock/OAuth servers) + reqwest (HTTP client).
- **State**: 4 Zustand stores — `appStore` (screen routing), `flowStore` (undo/redo snapshots, max 50), `execStore` (loading/responses), `authStore` (user session). Re-exported: `useAppStore` from `store/index.ts`.
- **Flow**: `@xyflow/react` v12 — 2 node types (`url`, `method`), 1 edge type (`animated`). Node registration: `src/components/nodes/index.ts`, edge registration: `src/components/edges/index.ts`.
- **4 screens** (`appStore.screen`): `onboarding` → `auth` → `main` → `settings`
- **Auth**: Appwrite v26 SDK. Email/password or OAuth (Google, GitHub) via manually-constructed URL + ephemeral axum callback server on `127.0.0.1:0`. Guest mode skips auth; premium features (history, node search, mock APIs) guarded by `AuthGuard`.
- **DB**: Appwrite `greq_db` — collections `historial` (last 20 entries) and `mock_apis` (max 20). Per-user document permissions. Guest fallback: localStorage (`greq-history`, `greq-mock-apis`).

## Node Data & Execution
- **URL node**: `{ url, title, params:[], headers:[] }`
- **Method node**: `{ method, headers, body, bodyType, auth, authValue, repeatCount }` (default 1)
- **Sidebar drag keys**: `'url'`, `'get'`, `'post'`, `'delete'`, `'update'`
- **Execution**: walks edges backward through URL nodes for `$prev` resolution. `repeatCount` runs N times (all responses stored).
- **Save/Load**: `{ nodes, edges }` JSON download / file input `accept=".json"`.

## Variable Syntax (`src/utils/resolveVariables.ts`)
```
{{$prev.body.path.to.field}}  — JSON body path
{{$prev.body}}                — full body as string
{{$prev.headers.Header-Name}} — case-insensitive header lookup
{{$prev.status}}              — status code
{{$prev.statusText}}          — status text
{{nodeId.body.path}}          — explicit node reference
```

## Backend IPC (`src-tauri/src/`)
All Rust structs use `#[serde(rename_all = "camelCase")]` — JS sends `bodyType`, `authType`, `port`, etc.
- `make_request` — reqwest HTTP call. Auto-prepends `http://` if no scheme. 30s timeout. Body: JSON (auto-parse with fallback to raw), text, or form. Auth: Bearer or Basic. Debug `eprintln!` in debug builds only.
- `start_mock_server` / `stop_mock_server` — axum mock server, graceful shutdown via oneshot channel. Config: `{ path, method, status, headers, body, port }` (port optional, random if 0). Responds to all routes.
- `start_oauth_server` — binds `127.0.0.1:0`, returns port. Route `/callback` captures `?userId&secret`.
- `wait_oauth_callback(port)` — polls every 500ms for up to 3min, returns `{ userId, secret }`.

## Known Issues
- ~~MockApi panel: blank screen on "Generar API" click (requires browser console debugging).~~ Fixed — `crypto.randomUUID()` replaced with `crypto.getRandomValues` + fallback.
- **invoke hangs when Tauri backend is not ready**: `window.__TAURI_INTERNALS__` is set by Tauri webview preload even before Rust backend is fully compiled/started. `invoke` tries IPC via `http://ipc.localhost` then falls back to `postMessage` but the promise **never rejects** — hangs forever. Fix: `invokeWithTimeout()` wrapper (4s timeout) used in `startApi`. The `startApi` catch block shows the timeout error to user.
- **Mock servers no persisten entre sesiones**: Al elegir "Cerrar y mantener abiertas", el estado se guarda en localStorage y al reabrir la app aparece un banner para restaurar los servidores. Pero los servidores reales (procesos tokio en Rust) mueren al cerrar la app. El usuario debe presionar "Restaurar" manualmente para reiniciarlos.
