# GReq — Visual Node-Based API Client

## Stack
- **Desktop:** Tauri v2 (Rust)
- **Frontend:** React 18 + TypeScript + Vite
- **Nodes:** `@xyflow/react`
- **Styles:** TailwindCSS + dark mode via `dark` class on `<html>`
- **State:** Zustand
- **HTTP:** reqwest (Rust side, `rustls-tls`, no native TLS, JSON enabled)

## Commands
- `npm run dev` — Vite dev server (port 1420, strict port, HMR 1421 when `TAURI_DEV_HOST` is set)
- `npm run tauri dev` — Tauri desktop app (auto-starts Vite)
- `npm run build` — `tsc && vite build` (type-check runs first)
- `npm run tauri build` — Release build
- No test/lint scripts

## Frontend
- **Entrypoint:** `index.html` (lang `es`, dark-mode flicker guard via localStorage `api-flow-theme`) → `src/main.tsx`
- **Logo:** 3 connected black dots on white bg (`src/components/Logo.tsx`)
- **Screens (Zustand-driven navigation):** `onboarding` → `auth` → `main` (appStore `screen`, barrel-exported via `src/store/index.ts`)
- **App.tsx** syncs theme class on `<html>` via `useEffect`; `src/store/themeStore` persists to `localStorage`, defaults to `light`
- **Onboarding:** 3 slides with inline SVG illustrations, keyboard nav (ArrowLeft/Right/Space), "Saltar"/"Comenzar" buttons
- **AuthPage:** signin/signup toggle (Spanish labels), Google/GitHub mock buttons, no real auth — `onSuccess` callback transitions to `main`
- **MainApp:** header + right sidebar ("Hacer peticiones", "Mandar llamar APIs") + gear icon top-right opens `SettingsModal` (theme toggle)
- **ThemeToggle:** removed — theme toggle is now inside `SettingsModal`
- **Styles:** `src/index.css` — Tailwind directives, custom scrollbar (`6px`), `.screen-enter` fade-in animation, emerald selection color
- **TS strict** with `noUnusedLocals` + `noUnusedParameters`; Vite ignores `src-tauri/**`
- **`src/components/nodes/`** still empty — custom React Flow nodes pending

## Rust backend
- Cargo crate `api-flow`, lib `api_flow_lib`; `src-tauri/src/main.rs` calls `api_flow_lib::run()`
- `src-tauri/src/lib.rs` — placeholder `run()` with no custom commands yet
- `make_request` command not implemented (MVP task)
- Capabilities (`src-tauri/capabilities/default.json`): only `core:default` — must add permissions for custom commands
- reqwest 0.12 with `json` + `rustls-tls` features (no `native-tls`)

## Project state
Frontend screens (onboarding, auth, main) built with right sidebar + settings modal. Store layer complete. Rust backend is a stub. Next: implement `make_request` command and React Flow node canvas.
