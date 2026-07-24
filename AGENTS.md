# GReq — Visual Node-Based API Client

## Commands
```
npm run dev          # Vite dev (port 1420, strictPort)
npm run tauri dev    # Tauri dev — auto-runs npm run dev
npm run build        # tsc && vite build
npm run preview      # Vite preview (serve dist/)
npm run tauri build  # Release — auto-runs npm run build
npm run tauri        # Tauri CLI passthrough
```
No lint/test/format/codegen scripts. No test files. `noUnusedLocals` + `noUnusedParameters` in tsconfig — `tsc` fail on unused imports. `src-tauri/` excluded from Vite watch. Build outputs: `dist/` (Vite), `src-tauri/target/` (Rust).

## Stack & Architecture
- **Frontend** (`src/`): React 18 + Vite 5 + TailwindCSS 3 (`darkMode: 'class'`) + Geist font (Google Fonts in `index.html`). No router — screen via `appStore.screen: onboarding|auth|main|settings` (`src/store/appStore.ts`).
- **Backend** (`src-tauri/`): Rust crate `api-flow`, lib `api_flow_lib`. Tauri v2 + axum 0.7 (mock/OAuth) + reqwest 0.12 (rustls-tls).
- **`index.ts` re-exports**: Only `useAppStore` + `Screen` from `store/index.ts`. Other stores import directly (e.g. `from '../store/flowStore'`).
- **Dark mode**: Toggled `MainApp.tsx:95-99`, persisted `localStorage('greq-theme')`. Applies `dark` class to `<html>`.
- **Auth**: Appwrite v26. Endpoint/project hardcoded `src/lib/appwrite.ts:3-4`. DB `greq_db` (collections `historial` 20 entries, `mock_apis` 20 max). Guest fallback: `localStorage('greq-history')`, `localStorage('greq-mock-apis')`.
- **`.env.local`** (not committed): `VITE_GITHUB_CLIENT_ID`, `VITE_GITHUB_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_SECRET`.
- **Imports**: Postman, OpenAPI (simple YAML parser — no anchors/circular refs), cURL (`src/lib/parsePostman.ts`, `src/lib/openapi.ts`, `src/lib/parseCurl.ts`). GitHub import scans repos for OpenAPI specs (`src/lib/github.ts`, 420 lines).

## State (6 Zustand stores)
- `appStore` — `screen` drives view
- `authStore` — `user`, `checked`
- `flowStore` — undo/redo, 50 snapshots max
- `execStore` — loading, responses, responseHistory (20 per node)
- `aiStore` — placeholder
- `envStore` — 3 defaults (dev/staging/prod), persisted `localStorage('greq-env-*')`; search in EnvPanel when ≥6 vars

All in-memory (Zustand defaults). `envStore` + `flowStore` explicitly persist to localStorage. Collections: `src/lib/collections.ts` via `localStorage('greq-collections')`.

## React Flow
- **Node types** (`src/components/nodes/index.ts`): `url` (data: `src/types.ts:25-31`), `method` (data: `src/types.ts:33-44`)
- **Edge type** (`src/components/edges/index.ts`): `animated`
- **ReactFlowProvider** wraps `MainApp.tsx`
- **Connections**: URL(source)→Method(target); Method(source)→Method(target)
- **Keyboard**: Ctrl+Z undo, Ctrl+Shift+Z/Y redo, Delete/Backspace remove selected (locked nodes immune)
- **Sidebar drag keys** (`NodeCard.tsx`): `'url'`, `'get'`, `'post'`, `'put'`, `'patch'`, `'delete'`, `'update'`
- **Lock**: `locked: true` prevents drag, edit, select, execute, delete. Toggle via ConfigPanel or ContextMenu.
- **Auto-layout**: TopBar, column-based (`MainApp.tsx:455-479`).
- **Flow save/load**: `.json` download, upload restore (`MainApp.tsx:411-447`).

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
Walks edges backward for `$prev`. Env checked first.

## IPC (9 commands in `src-tauri/src/lib.rs:181-190`)
All Rust structs `#[serde(rename_all = "camelCase")]`.

- **`make_request`** — auto-prepend `http://` if no scheme, 30s timeout, maps UPDATE→PUT
- **Mock servers** (`start_mock_server`/`stop_mock_server`/`stop_all_mock_servers`): axum on `127.0.0.1:{port}` (random if 0). Per-method responses, typed fields (`string`/`int`/`bool`/`float`), pagination (`?page=N&limit=M` + `X-Total-Count`/`Link`), rate limiting (429 + `Retry-After`), delay, `{{env.VAR_NAME}}` resolution. Axum catch-all: `/*path` not `/{*path}`.
- **OAuth** (`start_oauth_server`/`wait_oauth_callback`/`start_oauth_webview`): ephemeral axum + Tauri WebviewWindow for Appwrite OAuth, intercepts `cloud.appwrite.io/console/auth/oauth2/success`
- **Login** (`login_with_github`/`login_with_google`): backend OAuth → browser → callback → code exchange → user fetch. Frontend creates Appwrite user with deterministic password: `greq_oauth_` + sanitized email + `'A1'` (`AuthPage.tsx:75-79`).
- **Dynamic templates** (`mock.rs` `resolve_dynamic`): `{{$uuid}}`, `{{$timestamp}}`, `{{$randomInt}}`, `{{$randomBoolean}}`, `{{$randomName}}`, `{{$randomEmail}}`, `{{$randomWord}}`, `{{$randomNumber(min,max)}}`

## Known Issues & Conventions
- **`invoke` hangs if Tauri backend not ready**: `invoke` never rejects. Use `invokeWithTimeout()` (`src/lib/tauri.ts`). Default 4s; pass 3rd arg for longer (e.g. 35s for `make_request`).
- **Mock servers die on app close**: Tokio processes. Tracked `localStorage('greq-running-servers')`. Close handler: modal with 3 options (stop all / keep running / cancel).
- **Codegen** (`src/lib/codegen.ts`): cURL, HTTPie, Python, JavaScript, Rust. Resolves env if toggled.
- **AI Assistant** (`src/lib/ai.ts`): 100% offline template-based. No API key. Not real LLM.
- **History**: Auto-save when URL node gets title (`MainApp.tsx:118-146`). Synced to Appwrite if logged in. 20 entries max.
