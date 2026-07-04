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
- **Frontend**: `src/` — React 18 + TypeScript + Vite + TailwindCSS. Light-mode only (themeStore `toggle: () => {}`). Font: Geist (Google Fonts, `index.html`).
- **Backend**: `src-tauri/` — Rust crate `api-flow` / lib `api_flow_lib`, Tauri v2. IPC: `make_request`, `start_mock_server`, `stop_mock_server`.
- **State**: Zustand — 4 stores (`appStore`, `flowStore`, `execStore`, `themeStore`). Only `useAppStore` and `useThemeStore` re-exported from `store/index.ts`.
- **Flow**: `@xyflow/react` v12 — 2 node types (`url`, `method`), 1 edge type (`animated`).

## Architecture
- **4 screens** (`appStore.screen`): `onboarding` → `auth` → `main` → `settings`
- **Auth**: client-side stub — any form submission calls `onSuccess()`. No backend auth.
- **ThemeStore**: stub `toggle: () => {}`. `ThemeToggle.tsx` exists but is never rendered (dead code).
- **Sidebar drag keys**: `'url'` for URL nodes; `'get'`, `'post'`, `'delete'`, `'update'` for methods.
- **Node data shapes**: UrlNode `{ url, title, params:[], headers:[] }`; MethodNode `{ method, headers, body, bodyType, auth, authValue, repeatCount }` (repeatCount defaults to 1).
- **Request execution**: walks edges backward through URL nodes to find previous method for `$prev` resolution. Supports `repeatCount` for running a request N times (all responses stored). Execution registered via `execStore.setExecuteFn`.
- **Variable resolution** (`resolveVariables.ts`): `$prev` → nearest preceding method; `nodeId` → explicit reference. Case-insensitive header lookup.
- **Mock API panel**: split-view (sidebar + detail), multi-tab, method filter + search, localStorage (`greq-mock-apis`, max 20).
- **History**: localStorage (`greq-history`, last 20). Auto-saves on title set or "Guardar".
- **Group-aware deletion**: named URL node with methods → modal: delete group or orphan methods.
- **Save/Load**: `{ nodes, edges }` JSON download; file input `accept=".json"`.
- **Undo/redo**: 50 snapshots via `flowStore`. Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y.
- **Delete/Backspace**: removes selected node.

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
- `src-tauri/capabilities/default.json`: only `core:default` permission
- `vite.config.ts`: port 1420 (strict), HMR port 1421 when `TAURI_DEV_HOST` set
