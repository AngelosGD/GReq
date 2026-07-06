# GReq — Visual Node-Based API Client

## Commands
```bash
npm run dev          # Vite dev (port 1420, strictPort)
npm run tauri dev    # Tauri dev → auto-runs npm run dev
npm run build        # tsc && vite build
npm run tauri build  # Release → auto-runs npm run build
```
No lint/test/format/codegen. `noUnusedLocals` + `noUnusedParameters` — `tsc` fails on unused imports.

## Stack & Architecture
- **Frontend** (`src/`): React 18 + TS + Vite + TailwindCSS 3 (darkMode: `class`). Font: Geist (Google Fonts in `index.html`).
- **Backend** (`src-tauri/`): Rust crate `api-flow`, lib `api_flow_lib`. Tauri v2 + axum 0.7 (mock/OAuth) + reqwest 0.12 (rustls-tls).
- **State**: 5 Zustand stores — `appStore` (routing), `flowStore` (undo/redo, max 50), `execStore` (loading/responses), `authStore` (user session), `aiStore` (provider/key). Re-exported: `useAppStore` from `store/index.ts`.
- **Flow**: `@xyflow/react` v12 — 2 node types (`url`, `method`), 1 edge type (`animated`). Registration: `src/components/nodes/index.ts`, `src/components/edges/index.ts`.
- **4 screens** (`appStore.screen`): `onboarding` → `auth` → `main` → `settings`
- **Auth**: Appwrite v26 SDK. Email/password or OAuth (Google, GitHub) via constructed URL + ephemeral axum callback on `127.0.0.1:0`. Guest mode skips auth; premium features (history, node search, mock APIs) behind `AuthGuard`.
- **DB**: Appwrite `greq_db` — collections `historial` (20 entries) and `mock_apis` (20 max). Per-user document perms. Guest fallback: localStorage (`greq-history`, `greq-mock-apis`).

## Node Data & Execution
- **URL node**: `{ url, title, params:[], headers:[] }`
- **Method node**: `{ method, headers, body, bodyType, auth, authValue, repeatCount }` (default 1)
- **Sidebar drag keys**: `'url'`, `'get'`, `'post'`, `'delete'`, `'update'`
- **Execution**: walks edges backward through URL nodes for `$prev` resolution. `repeatCount` runs N times (all responses stored). Connections: URL(source) → Method(target), Method(source) → Method(target) for chaining.
- **Save/Load**: `{ nodes, edges }` JSON download / file input `accept=".json"`.

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
- All Rust structs `#[serde(rename_all = "camelCase")]` — JS sends `bodyType`, `authType`, `port`.
- `make_request` — auto-prepends `http://` if no scheme, 30s timeout
- `start_mock_server` — axum mock, graceful shutdown (oneshot). `MockConfig: { path, methods, status, headers, body, port }` — port optional, random if 0
- `start_oauth_server` / `wait_oauth_callback` — binds `127.0.0.1:0`, poll 500ms up to 3min, returns `{ userId, secret }`
- `stop_mock_server` / `stop_all_mock_servers`

## Known Issues
- **invoke hangs when Tauri backend not ready**: `window.__TAURI_INTERNALS__` set by webview preload before Rust backend ready. `invoke` never rejects — hangs forever. Fix: `invokeWithTimeout()` wrapper (4s) in `MockApi.tsx:8`.
- **Mock servers don't persist between sessions**: Tokio processes die on app close. State in `localStorage('greq-running-servers')`. Reopen: banner asks manual restore.
- **Axum catch-all route**: axum 0.7 `/*path`, not `/{*path}`. Fixed in `mock.rs:130`.

## Recent Redesign (Jul 2026)
- **Smart mock backend** (`mock.rs`): per-method handler — GET returns array (no ID) or single (/:id), POST merges body+fields → 201 + generated ID, DELETE returns `{deleted:true,id}`, UPDATE/PUT/PATCH returns `{updated:true,id,data}`.
- **Sample data**: `MockApiItem.sampleData: Record<string,string>[]` for multi-record examples. Table editor in create form. Backend uses it for GET responses.
- **Node redesign**: UrlNode + MethodNode — clean cards (no glass/ping/gradient), left accent bar by method color. Execute button: linear gradient + subtle shadow.
- **Sidebar redesign**: nav items with left accent bar, neutral hover states, no saturated backgrounds. NodeCard: compact row with dot + label + subtitle.
- **Config redesign**: MethodConfig tabs → colored underline border, neutral focus rings. ConfigPanel: minimal dot+label header.
- **Edge**: removed dashed overlay, kept gradient line, subtle glow on select.
