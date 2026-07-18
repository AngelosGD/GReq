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
No lint/test/format/codegen. `noUnusedLocals` + `noUnusedParameters` in tsconfig — `tsc` fails on unused imports. `src-tauri/` excluded from Vite watch (vite.config.ts:21).

## Stack
- **Frontend** (`src/`): React 18 + Vite 5 + TailwindCSS 3 darkMode `class` + Geist font (Google Fonts in `index.html`). No router — screen switching via `appStore.screen: onboarding|auth|main|settings` (`src/store/appStore.ts`).
- **Backend** (`src-tauri/`): Rust crate `api-flow`, lib `api_flow_lib`. Tauri v2 + axum 0.7 (mock/OAuth) + reqwest 0.12 (rustls-tls).
- **State** (7 Zustand stores): `appStore`, `authStore`, `flowStore` (undo/redo, 50 snapshots max), `execStore` (loading/responses), `aiStore`, `envStore`, `envStore`. Re-exported: `useAppStore` from `store/index.ts`.
- **Flow**: `@xyflow/react` v12 — 2 node types (`url`, `method`), 1 edge type (`animated`). Registration: `src/components/nodes/index.ts`, `src/components/edges/index.ts`. `ReactFlowProvider` inside `MainApp.tsx`. Keyboard: Ctrl+Z undo, Ctrl+Shift+Z/Y redo, Delete/Backspace removes selected node.
- **Auth**: Appwrite v26 SDK. Endpoint `https://nyc.cloud.appwrite.io/v1`, project `6a498aae000bdc5c653d`, DB `greq_db` (collections `historial` 20 entries, `mock_apis` 20 max). Guest fallback: `localStorage('greq-history')`, `localStorage('greq-mock-apis')`.
- **`.env.local`** (not committed): `VITE_GITHUB_CLIENT_ID`, `VITE_GITHUB_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_SECRET`.

## IPC (9 commands in `src-tauri/src/lib.rs:170-179`)
All Rust structs `#[serde(rename_all = "camelCase")]`.

- `make_request` — auto-prepend `http://` if no scheme, 30s timeout, maps UPDATE→PUT
- `start_mock_server` — axum mock on `127.0.0.1:{port}` (random if 0). `MockConfig`: `{ path, methods, status, headers, body, port, delayMs, methodConfigs, fields, sampleData }`. Smart per-method handler: GET returns array/list or single (/:id), POST merges body+fields → 201+gen ID, DELETE → `{deleted:true,id}`, UPDATE/PUT/PATCH → `{updated:true,id,data}`. Fields typed: `string`/`int`/`bool`.
- Dynamic templates (Rust `resolve_dynamic`): `{{$uuid}}`, `{{$timestamp}}`, `{{$randomInt}}`, `{{$randomBoolean}}`, `{{$randomName}}`, `{{$randomEmail}}`, `{{$randomWord}}`, `{{$randomNumber(min,max)}}`.
- `start_oauth_webview(url)` — Tauri WebviewWindow for Appwrite OAuth, intercepts `cloud.appwrite.io/console/auth/oauth2/success`
- `login_with_github` / `login_with_google` — backend OAuth (ephemeral axum → browser → callback → code exchange → user fetch). Frontend creates Appwrite user with deterministic password: `greq_oauth_` + `btoa(email + ':greq').slice(0,16)`.

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

## Node Data
- **URL node**: `{ url, title, params:[], headers:[] }` — sidecar, no request sent
- **Method node**: `{ method, headers, body, bodyType, auth, authValue, repeatCount }` (default 1). Walks edges backward for `$prev` resolution. Connections: URL(source)→Method(target); Method(source)→Method(target)
- **Sidebar drag keys** (HTML5 native Drag API, `NodeCard.tsx`): `'url'`, `'get'`, `'post'`, `'put'`, `'patch'`, `'delete'`, `'update'`

## Known Issues
- **invoke hangs when Tauri backend not ready**: `invoke` never rejects if backend not ready. Use `invokeWithTimeout()` (4s) from `MockApi.tsx:12-15` for any `invoke` racing backend init.
- **Mock servers don't persist between sessions**: Tokio processes die on app close. Tracked in `localStorage('greq-running-servers')`.
- **Axum catch-all**: axum 0.7 uses `/*path`, not `/{*path}` (`mock.rs:540`).

## Limitations (Important)
- OpenAPI YAML parser indent-based — no multi-line strings, arrays, `$ref`, anchors (`src/lib/openapi.ts:51-84`)
- No per-route method config on import — all methods share one responseBody
- Mock server lacks pagination, rate limiting, conditional responses, WebSocket, SSE
- cURL/HAR/Postman/Insomnia import unsupported
- `__history` endpoint exists (`GET /__history`) but no frontend UI button
- No response validation or schema generation
