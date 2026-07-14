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
- **Frontend** (`src/`): React 18 + TS + Vite 5 + TailwindCSS 3 (darkMode `class`, emerald focus rings, custom thin scrollbar). Font: Geist (Google Fonts in `index.html`).
- **Backend** (`src-tauri/`): Rust crate `api-flow`, lib `api_flow_lib`. Tauri v2 + axum 0.7 (mock/OAuth) + reqwest 0.12 (rustls-tls).
- **State** (5 Zustand stores): `appStore` (routing, `screen: onboarding|auth|main|settings`), `flowStore` (undo/redo, max 50 snapshots, Ctrl+Z / Ctrl+Shift+Z), `execStore` (loading/responses), `authStore` (user session), `aiStore` (provider/key). Re-exported: `useAppStore` from `store/index.ts`.
- **Flow**: `@xyflow/react` v12 — 2 node types (`url`, `method`), 1 edge type (`animated`). Registration: `src/components/nodes/index.ts`, `src/components/edges/index.ts`. `ReactFlowProvider` inside `MainApp.tsx` (not at App level).
- **Auth**: Appwrite v26 SDK. Email/password or OAuth (Google, GitHub). Guest mode skips auth; `AuthGuard` blocks premium features.
- **No router**: Screen switching via `appStore.screen` — no `<Routes>`/`<Router>`.
- **`.env.local`**: OAuth secrets required (not committed, in `.gitignore`): `VITE_GITHUB_CLIENT_ID`, `VITE_GITHUB_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_SECRET`.
- **DB**: Appwrite `greq_db` — collections `historial` (20 entries), `mock_apis` (20 max). Per-user document perms. Guest fallback: `localStorage('greq-history')`, `localStorage('greq-mock-apis')`.
- **GitHubSection**: Sidebar panel. Two empty-state buttons: paste repo URL → `importFromGithub`, or connect GitHub OAuth → fetch repos → checkbox picker → import selected. Token stored in `localStorage('greq-github-token')` and used by `guessRoutes` via `authHeaders()` for API auth.
- **Route detection** (`src/lib/github.ts`): `importFromGithub` → tries OpenAPI specs → `guessRoutes` fetches full git tree via API, filters code files, applies per-extension regex patterns (JS/TS: `router.get('/path')`, Python: `@router.get('/path')` + `@app.route('/path')`, Rust: `#[get("/path")]`, Go: `router.GET("/path")`). Max 30 files, skips `node_modules/`, deduplicates, no fallback endpoints.

## Node Data & Execution
- **URL node data**: `{ url, title, params:[], headers:[] }` — sidecar data, no request sent.
- **Method node data**: `{ method, headers, body, bodyType, auth, authValue, repeatCount }` (default 1). Runs actual HTTP request.
- **Sidebar drag keys** (HTML5 native Drag API, see `NodeCard.tsx`): `'url'`, `'get'`, `'post'`, `'put'`, `'patch'`, `'delete'`, `'update'`.
- **Execution**: walks edges backward through URL nodes for `$prev` resolution. `repeatCount` runs N times (responses stored in `responses[]`). Connections: URL(source) → Method(target); Method(source) → Method(target) for chaining.
- **Save/Load**: `{ nodes, edges }` JSON download / file input `accept=".json"`.
- **Auto-save**: History auto-saves when URL node title is set (to Appwrite or localStorage).
- **Node colors** (`src/constants.ts`): url/GET=emerald, POST=blue, PUT=orange, PATCH=purple, DELETE=red, UPDATE=yellow.

## Variable Syntax (`src/utils/resolveVariables.ts`)
```
{{$prev.body.path.to.field}}  — JSON body path from previous method
{{$prev.body}}                — full body string
{{$prev.headers.Header-Name}} — case-insensitive header lookup
{{$prev.status}}              — status code
{{$prev.statusText}}          — status text
{{nodeId.body.path}}          — explicit node reference by ID
```

## Backend IPC (`src-tauri/src/lib.rs` — 9 registered commands)
All Rust structs `#[serde(rename_all = "camelCase")]` — JS sends `bodyType`, `authType`, `port`, etc.

- `make_request` — auto-prepends `http://` if no scheme, 30s timeout, maps UPDATE→PUT
- `start_mock_server` — axum mock on `127.0.0.1:{port}` (random if 0). `MockConfig`: `{ path, methods, status, headers, body, port, delayMs, methodConfigs, fields, sampleData }`. Smart per-method handler: GET returns array (no ID) or single (/:id), POST merges body+fields → 201+gen ID, DELETE → `{deleted:true,id}`, UPDATE/PUT/PATCH → `{updated:true,id,data}`. Fields typed schema (`string`/`int`/`bool`). Inspect endpoint at `GET /__inspect` returns last request.
- `stop_mock_server(id)` / `stop_all_mock_servers` — graceful via oneshot channel
- `start_oauth_webview(url)` — creates Tauri WebviewWindow for Appwrite OAuth, intercepts `cloud.appwrite.io/console/auth/oauth2/success`
- `start_oauth_server` / `wait_oauth_callback` — legacy (replaced by webview for Appwrite)
- `login_with_github(clientId, clientSecret)` / `login_with_google(clientId, clientSecret)` — backend-driven OAuth (browser → callback → code exchange → user fetch)

## OAuth (Appwrite Cloud — Fixed via Webview)
Appwrite cloud v26 ignores custom redirect URLs and sends users to `cloud.appwrite.io/console/auth/oauth2/success?key=...&secret=...` instead of our callback server. **Fix**: `start_oauth_webview` (Rust) creates a Tauri `WebviewWindow`, navigates to the Appwrite OAuth URL, and uses `on_navigation` to intercept the console success URL, extracting `key`/`secret` from query params. Replaces the old `start_oauth_server` + `openUrl` + `wait_oauth_callback` flow in `AuthPage.tsx`.

## Direct OAuth (GitHub & Google — via Browser)
`login_with_github` and `login_with_google` (Rust, `auth.rs`) handle OAuth entirely in the backend: starts ephemeral axum server → opens system browser to OAuth URL → receives callback → exchanges code for token → fetches email/name → returns `{ email, name }`. Frontend then creates/logins an Appwrite user with deterministic derived password (`greq_oauth_` + `btoa(email + ':greq').slice(0,16)`). OAuth credentials in `.env.local` (not committed).

## Known Issues
- **invoke hangs when Tauri backend not ready**: `window.__TAURI_INTERNALS__` set by webview preload before Rust backend is ready. `invoke` never rejects. Wrapper: `invokeWithTimeout()` (4s) in `src/components/MockApi.tsx:11-15`.
- **Mock servers don't persist between sessions**: Tokio processes die on app close. Tracked in `localStorage('greq-running-servers')`. Banner on reopen asks manual restore.
- **Axum catch-all**: axum 0.7 uses `/*path`, not `/{*path}`. Done in `mock.rs:379`.
- **Vite strict port**: Port 1420. HMR on 1421 if `TAURI_DEV_HOST` is set. `src-tauri/` excluded from Vite watch.
