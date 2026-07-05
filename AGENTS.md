# GReq — Visual Node-Based API Client

## Commands
```bash
npm run dev          # Standalone Vite dev (port 1420, strictPort)
npm run tauri dev    # Tauri — auto-runs `npm run dev` via beforeDevCommand
npm run build        # tsc + vite build (typecheck first)
npm run tauri build  # Release — auto-runs `npm run build` via beforeBuildCommand
npm run preview      # Vite preview of built frontend
npm run tauri        # Tauri CLI shortcut
```
No lint, test, or format commands exist.

## Stack
- **Frontend**: `src/` — React 18 + TypeScript + Vite + TailwindCSS. Light-mode only. Font: Geist (Google Fonts, `index.html`).
- **Backend**: `src-tauri/` — Rust crate `api-flow` / lib `api_flow_lib`, Tauri v2. IPC: `make_request`, `start_mock_server`, `stop_mock_server`, `start_oauth_server`, `wait_oauth_callback`.
- **Auth**: Appwrite v26 (`appwrite` npm pkg). Email/password + OAuth (Google, GitHub) via ephemeral axum callback server.
- **DB**: Appwrite Database (`greq_db`), collections: `historial`, `mock_apis`. Per-user document-level permissions.
- **State**: Zustand — 5 stores (`appStore`, `flowStore`, `execStore`, `authStore`). `useAppStore` re-exported from `store/index.ts`.
- **Flow**: `@xyflow/react` v12 — 2 node types (`url`, `method`), 1 edge type (`animated`).
- **Opener**: `tauri-plugin-opener` + `@tauri-apps/plugin-opener` for system browser OAuth.

## Architecture
- **4 screens** (`appStore.screen`): `onboarding` → `auth` → `main` → `settings`
- **Auth flow**: onboarding → auth (email/password, Google, GitHub) OR "Entrar como invitado" (salta auth). Sesión persiste al cerrar app (Appwrite session cookie).
- **AuthGuard** (`src/components/AuthGuard.tsx`): wrapper que bloquea features premium si no hay sesión: historial, buscador de nodos, mock APIs. Muestra modal con "Iniciar sesión".
- **ProfileModal** (`src/components/ProfileModal.tsx`): hover sobre gear icon → dropdown con email, "Perfil" (muestra nombre/email), "Cerrar sesión" (borra sesión Appwrite + redirige a auth).
- **Sidebar drag keys**: `'url'` for URL nodes; `'get'`, `'post'`, `'delete'`, `'update'` for methods.
- **Node data shapes**: UrlNode `{ url, title, params:[], headers:[] }`; MethodNode `{ method, headers, body, bodyType, auth, authValue, repeatCount }` (repeatCount defaults to 1).
- **Request execution**: walks edges backward through URL nodes to find previous method for `$prev` resolution. Supports `repeatCount` for running a request N times (all responses stored). Execution registered via `execStore.setExecuteFn`.
- **Variable resolution** (`resolveVariables.ts`): `$prev` → nearest preceding method; `nodeId` → explicit reference. Case-insensitive header lookup.
- **Mock API panel**: split-view (sidebar + detail), multi-tab, method filter + search. Persist: localStorage + Appwrite (`greq_db.mock_apis`, per-user, max 20).
- **History**: localStorage + Appwrite (`greq_db.historial`, per-user, last 20). Auto-saves on title set AND on edge connect/disconnect (syncs method count).
- **Group-aware deletion**: named URL node with methods → modal: delete group or orphan methods.
- **Save/Load**: `{ nodes, edges }` JSON download; file input `accept=".json"`.
- **Undo/redo**: 50 snapshots via `flowStore`. Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y. Reactive `canUndo`/`canRedo` via `useUndoRedo` hook.
- **Delete/Backspace**: removes selected node.

## Auth (Appwrite)
- **SDK**: `src/lib/appwrite.ts` — `Client`, `Account`, `ID`, `OAuthProvider`. Endpoint: `https://nyc.cloud.appwrite.io/v1`, Project: `6a498aae000bdc5c653d`.
- **Email/password**: `createEmailPasswordSession` (login), `create` + `createEmailPasswordSession` (signup).
- **OAuth (Google/GitHub)**: construct URL manually (avoid SDK redirect), open in system browser via `tauri-plugin-opener`. Axum callback server (`start_oauth_server` / `wait_oauth_callback`) catches userId+secret from redirect, calls `createSession`.
- **Guest mode**: botón "Entrar como invitado" en AuthPage → salta a main sin autenticar. Features premium bloqueadas por AuthGuard.
- **Session persist**: `App.tsx` checkea `getCurrentUser()` al inicio. Si existe sesión, salta onboarding+auth y va directo a main.
- **Logout**: `deleteSession('current')` + `setUser(null)` + `goToAuth()`.

## Database (Appwrite)
- **File**: `src/lib/database.ts` — `Databases` API (`greq_db`).
- **Collections**:
  - `historial`: fields `userId`, `entryId`, `title`, `url`, `timestamp`, `methodCount`, `data` (JSON). Per-document permissions (`Permission.read(Role.user(userId))`).
  - `mock_apis`: fields `userId`, `apiId`, `config` (JSON). Same permission model.
- **Guest fallback**: si no hay sesión, usa localStorage (`greq-history`, `greq-mock-apis`). Al iniciar sesión, se cargan datos desde Appwrite.

## Components (`src/components/`)
- **MainApp.tsx** (~668 lines, was 1252): imports 6 extracted components (Canvas, ConfigPanel, ContextMenu, HistoryModal, GroupDeleteModal, AuthGuard). No inline sub-components.
- Extraídos en sesión previa: `Canvas.tsx`, `NodeCard.tsx`, `ContextMenu.tsx`, `ConfigPanel.tsx`, `KeyValueEditor.tsx`, `UrlConfig.tsx`, `MethodConfig.tsx`, `ResponseSection.tsx`, `HistoryModal.tsx`, `GroupDeleteModal.tsx`, `VariablesHint.tsx`.
- **Nuevos**: `AuthGuard.tsx`, `ProfileModal.tsx`.
- **Hooks**: `src/hooks/useUndoRedo.ts` — encapsula `undo`/`redo`/`canUndo`/`canRedo`.
- **Utils**: `src/utils/nodeData.ts` — `getUrlData(node)`, `getMethodData(node)` (tipados, reemplazan `as any`).

## Variable Syntax
- `{{$prev.body.path.to.field}}` — JSON body path
- `{{$prev.body}}` — full body as string
- `{{$prev.headers.Header-Name}}` — case-insensitive lookup
- `{{$prev.status}}` — status code
- `{{$prev.statusText}}` — status text
- `{{nodeId.body.path}}` — explicit node reference

## Backend (Rust)
- `serde(rename_all = "camelCase")` on all structs. JS sends `bodyType`, `authType`, `port` etc.
- `MockManager` global: `Mutex<HashMap<String, ShutdownSender>>`
- `AppError` enum (`thiserror`): `Network`, `InvalidMethod`, `Server`, `NotFound`. Implements `Serialize` for IPC.
- `OAuthState` global: `Arc<Mutex<HashMap<u16, Option<(String, String)>>>>` for OAuth callback server.

### IPC Commands
- `make_request` — HTTP request via reqwest. Auto-prepends `http://`. 30s timeout. JSON/text/form body. Bearer/Basic auth. Debug eprintln in debug builds. Headers: `filter_map` (skips non-UTF8).
- `start_mock_server` / `stop_mock_server` — axum mock server with graceful shutdown via oneshot channel.
- `start_oauth_server` — binds 127.0.0.1:0, returns port. Axum route `/callback` captures `?userId&secret` from Appwrite OAuth redirect.
- `wait_oauth_callback(port)` — polls every 500ms for up to 3min, returns `{ userId, secret }`.
- Opener plugin: `tauri-plugin-opener` registered, `opener:default` capability.

### `make_request`
- Auto-prepends `http://` when no scheme (also done in frontend before invoking)
- 30s hardcoded timeout; Body types: JSON (auto-parses, falls back to raw), text, form
- Auth: Bearer or Basic (`user:pass`); Debug output via `eprintln!` in debug builds only

### `start_mock_server`
- Config: `{ path, method, status, headers, body, port }` (port optional, random if 0)
- Returns: `{ url, id }`. Uses `axum::serve` with `with_graceful_shutdown` via oneshot. Responds to all routes.

### `stop_mock_server`
- Input: `{ id }`. Sends shutdown signal. Returns `()` or error if not found.

## Config Quirks
- `tsconfig.json`: strict, `noUnusedLocals`, `noUnusedParameters`, `skipLibCheck`
- `tauri.conf.json`: `beforeDevCommand: "npm run dev"`, `beforeBuildCommand: "npm run build"`, window 1000×650, CSP disabled
- `src-tauri/capabilities/default.json`: `core:default`, `opener:default`
- `vite.config.ts`: port 1420 (strict), HMR port 1421 when `TAURI_DEV_HOST` set
- Appwrite: Email/Password auth method ON. Password strength: None (for testing). OAuth redirect URLs: `http://127.0.0.1/callback`

## Known Issues
- MockApi panel blank screen on "Generar API" click (session actual, pendiente debuggear con F12 console)
