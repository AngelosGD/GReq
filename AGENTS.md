# GReq — Visual Node-Based API Client

## Commands
```bash
npm run dev          # Vite dev (port 1420, strictPort)
npm run tauri dev    # Tauri dev — auto-runs npm run dev
npm run build        # tsc && vite build
npm run tauri build  # Release — auto-runs npm run build
npm run preview      # vite preview
npm run tauri        # pass-thru to tauri CLI
```
No lint/test/format/codegen scripts. `noUnusedLocals` + `noUnusedParameters` in tsconfig — `tsc` fails on unused imports.

## Stack
- **Frontend** (`src/`): React 18 + TS + Vite 5 + TailwindCSS 3 (darkMode: `class`). Font: Geist (Google Fonts in `index.html`).
- **Backend** (`src-tauri/`): Rust crate `api-flow`, lib `api_flow_lib`. Tauri v2 + axum 0.7 (mock/OAuth) + reqwest 0.12 (rustls-tls).
- **State** (5 Zustand stores): `appStore` (routing, `screen: onboarding|auth|main|settings`), `flowStore` (undo/redo, max 50 snapshots), `execStore` (loading/responses), `authStore` (user session), `aiStore` (provider/key). Re-exported: `useAppStore` from `store/index.ts`.
- **Flow**: `@xyflow/react` v12 — 2 node types (`url`, `method`), 1 edge type (`animated`). Registration: `src/components/nodes/index.ts`, `src/components/edges/index.ts`.
- **Auth**: Appwrite v26 SDK. Email/password or OAuth (Google, GitHub) via constructed URL + ephemeral axum callback on `127.0.0.1:0`. Guest mode skips auth; premium features behind `AuthGuard`.
- **DB**: Appwrite `greq_db` — collections `historial` (20 entries), `mock_apis` (20 max). Per-user document perms. Guest fallback: `localStorage('greq-history')`, `localStorage('greq-mock-apis')`.

## Node Data & Execution
- **URL node data**: `{ url, title, params:[], headers:[] }` — sidecar data, no request sent.
- **Method node data**: `{ method, headers, body, bodyType, auth, authValue, repeatCount }` (default 1). Runs the actual HTTP request.
- **Sidebar drag keys** (HTML5 native drag): `'url'`, `'get'`, `'post'`, `'put'`, `'patch'`, `'delete'`, `'update'`.
- **Execution**: walks edges backward through URL nodes for `$prev` resolution. `repeatCount` runs N times (all responses stored in `responses[]`). Connections: URL(source) → Method(target); Method(source) → Method(target) for chaining.
- **Save/Load**: `{ nodes, edges }` JSON download / file input `accept=".json"`.
- **Method colors** (`src/constants.ts`): GET=green, POST=blue, PUT=orange, PATCH=purple, DELETE=red, UPDATE=yellow.

## Variable Syntax (`src/utils/resolveVariables.ts`)
```
{{$prev.body.path.to.field}}  — JSON body path from previous method
{{$prev.body}}                — full body string
{{$prev.headers.Header-Name}} — case-insensitive header lookup
{{$prev.status}}              — status code
{{$prev.statusText}}          — status text
{{nodeId.body.path}}          — explicit node reference by ID
```

## Backend IPC (`src-tauri/src/`)
- All Rust structs `#[serde(rename_all = "camelCase")]` — JS sends `bodyType`, `authType`, `port`, etc.
- `make_request` — auto-prepends `http://` if no scheme, 30s timeout
- `start_mock_server` — axum mock on `127.0.0.1:{port}` (random if 0). `MockConfig`: `{ path, methods, status, headers, body, port, delayMs, methodConfigs, fields, sampleData }`. Smart per-method handler: GET returns array (no ID) or single (/:id), POST merges body+fields → 201+gen ID, DELETE → `{deleted:true,id}`, UPDATE/PUT/PATCH → `{updated:true,id,data}`. Fields define typed schema (`string`/`int`/`bool`).
- `start_oauth_server` / `wait_oauth_callback` — binds `127.0.0.1:0`, poll 500ms up to 3min, returns `{ userId, secret }`
- `stop_mock_server(id)` / `stop_all_mock_servers` — graceful via oneshot channel

## Known Issues
- **invoke hangs when Tauri backend not ready**: `window.__TAURI_INTERNALS__` set by webview preload before Rust backend is ready. `invoke` never rejects. Fix: `invokeWithTimeout()` wrapper (4s) in `src/components/MockApi.tsx:10-14`.
- **Mock servers don't persist between sessions**: Tokio processes die on app close. Tracked in `localStorage('greq-running-servers')`. On reopen, banner asks manual restore.
- **Axum catch-all route**: axum 0.7 uses `/*path`, not `/{*path}`. Done in `mock.rs:379`.
