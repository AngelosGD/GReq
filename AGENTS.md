# GReq — Visual Node-Based API Client

## Commands
```
npm run dev          # Vite dev (port 1420, strictPort)
npm run tauri dev    # Tauri dev — auto-runs npm run dev
npm run build        # tsc && vite build
npm run tauri build  # Release — auto-runs npm run build
```
No lint/test/format/codegen. No test files/scripts/fixtures. `noUnusedLocals` + `noUnusedParameters` in tsconfig — `tsc` fail on unused imports. `src-tauri/` excluded from Vite watch (vite.config.ts:21). Build outputs: `dist/` (Vite), `src-tauri/target/` (Rust).

## Stack
- **Frontend** (`src/`): React 18 + Vite 5 + TailwindCSS 3 darkMode `class` + Geist font (Google Fonts in `index.html`). No router — screen via `appStore.screen: onboarding|auth|main|settings` (`src/store/appStore.ts`).
- **Backend** (`src-tauri/`): Rust crate `api-flow`, lib `api_flow_lib`. Tauri v2 + axum 0.7 (mock/OAuth) + reqwest 0.12 (rustls-tls).
- **State** (6 Zustand stores): `appStore`, `authStore`, `flowStore` (undo/redo, 50 snapshots max), `execStore` (loading/responses/responseHistory — 20 max per node), `aiStore`, `envStore` (profiles dev/staging/prod defaults, persisted `localStorage('greq-env-*')`). Re-exported: `useAppStore` from `store/index.ts`. Env indicator in TopBar (active profile badge + toggle); search input in EnvPanel when ≥6 vars.
- **Flow**: `@xyflow/react` v12 — 2 node types (`url`, `method`), 1 edge type (`animated`). Registration: `src/components/nodes/index.ts`, `src/components/edges/index.ts`. `ReactFlowProvider` inside `MainApp.tsx`. Keyboard: Ctrl+Z undo, Ctrl+Shift+Z/Y redo, Delete/Backspace remove selected.
- **Auth**: Appwrite v26. Endpoint/project hardcoded in `src/lib/appwrite.ts:3-4`. DB `greq_db` (collections `historial` 20 entries, `mock_apis` 20 max). Guest fallback: `localStorage('greq-history')`, `localStorage('greq-mock-apis')`.
- **`.env.local`** (not committed): `VITE_GITHUB_CLIENT_ID`, `VITE_GITHUB_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_SECRET`.

## IPC (9 commands in `src-tauri/src/lib.rs:170-180`)
All Rust structs `#[serde(rename_all = "camelCase")]`.

- `make_request` — auto-prepend `http://` if no scheme, 30s timeout, maps UPDATE→PUT
- `start_mock_server` / `stop_mock_server` / `stop_all_mock_servers` — axum mock on `127.0.0.1:{port}` (random if 0). MockConfig: `{ path, methods, status, headers, body, port, delayMs, methodConfigs, fields, sampleData, rateLimit (0=off), env_vars }`. Smart per-method: GET returns array/list or single (/:id), POST merges body+fields → 201+gen ID, DELETE → `{deleted:true,id}`, UPDATE/PUT/PATCH → `{updated:true,id,data}`. Fields typed: `string`/`int`/`bool`. Pagination via `?page=N&limit=M` + `X-Total-Count`/`Link`. Rate limiting: 429 + `Retry-After`. Env vars: `{{env.VAR_NAME}}` resolved from `env_vars`.
- `start_oauth_server` / `wait_oauth_callback` / `start_oauth_webview` — ephemeral axum callback + Tauri WebviewWindow for Appwrite OAuth, intercepts `cloud.appwrite.io/console/auth/oauth2/success`
- `login_with_github` / `login_with_google` — backend OAuth (ephemeral axum → browser → callback → code exchange → user fetch). Frontend creates Appwrite user with deterministic password: `greq_oauth_` + sanitized email `(replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0,10))` + `'A1'` (`AuthPage.tsx:75-79`).
- Dynamic templates (`mock.rs` `resolve_dynamic`): `{{$uuid}}`, `{{$timestamp}}`, `{{$randomInt}}`, `{{$randomBoolean}}`, `{{$randomName}}`, `{{$randomEmail}}`, `{{$randomWord}}`, `{{$randomNumber(min,max)}}`.

## Variable Syntax (`src/utils/resolveVariables.ts`)
```
{{$prev.body.path.to.field}}  — JSON body path from previous method
{{$prev.body}}                — full body string
{{$prev.headers.Header-Name}} — case-insensitive lookup
{{$prev.status}}              — status code
{{$prev.statusText}}          — status text
{{nodeId.body.path}}          — explicit node reference by ID
{{varName}}                   — env variable from active profile
```

## Node Data (`src/types.ts`)
- **URL node**: `{ url, title, params:[], headers:[], locked? }` — sidecar, no request sent
- **Method node**: `{ method, headers, body, bodyType, auth, authValue, repeatCount, locked? }` (default 1). Walks edges backward for `$prev` resolution. Connections: URL(source)→Method(target); Method(source)→Method(target)
- **Lock**: `locked: true` prevents drag, selection, edit, execute, delete. Toggle via ConfigPanel header or ContextMenu. Visual: lock icon + reduced opacity.
- **Sidebar drag keys** (HTML5 native Drag API, `NodeCard.tsx`): `'url'`, `'get'`, `'post'`, `'put'`, `'patch'`, `'delete'`, `'update'`

## Known Issues
- **invoke hangs Tauri backend not ready**: `invoke` never rejects if backend not ready. Use `invokeWithTimeout()` (`src/lib/tauri.ts`) for any `invoke` racing backend init. Default 4s; pass 3rd arg for longer (e.g. 35s for `make_request`).
- **Mock servers don't persist between sessions**: Tokio processes die on app close. Tracked in `localStorage('greq-running-servers')`.
- **Axum catch-all**: axum 0.7 uses `/*path`, not `/{*path}` (`mock.rs:688`).

## Limitations
- OpenAPI YAML parser indent-based — no anchors, circular refs, complex multi-line (`src/lib/openapi.ts`)
- Mock UI exposes only `['GET', 'POST', 'DELETE', 'UPDATE']` (`src/components/mockApi/types.ts:35`); PUT/PATCH usable in flow but not mock UI
- Mock server lacks conditional responses, WebSocket, SSE
- No HAR/Insomnia import (Postman + OpenAPI + cURL supported)
- No response schema auto-generation (manual validation available via ResponseSection validator)
