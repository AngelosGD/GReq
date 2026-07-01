# GReq

Cliente de APIs visual basado en nodos. Construido con Tauri v2, React 18, React Flow y TailwindCSS.

## Requisitos

- Node.js 18+
- Rust (stable)

## Desarrollo

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Features

- **Peticiones HTTP** — Nodos URL + Method (GET/POST/DELETE/UPDATE) arrastrables al canvas
- **Variables dinámicas** — `{{$prev.body.path}}`, `{{$prev.headers.X}}`, `{{$prev.status}}`, `{{nodeId.body.path}}`
- **Agrupación** — Nodos URL con nombre + métodos conectados, guardados en historial (`greq-history`, 20)
- **Historial** — Modal con grupos guardados, retomar o eliminar
- **Servidor Mock** — Panel de APIs de prueba con servidor real Rust/axum. Pestañas múltiples, crear/iniciar/detener/eliminar, búsqueda y filtro por método, body y status editables, persistencia en localStorage
- **Onboarding** — 3 slides con video e imágenes
- **Undo/redo** — 50 snapshots, Ctrl+Z / Ctrl+Shift+Z
- **Guardar/cargar** — Flujos completos en JSON
- **Búsqueda de grupos** — `NodeSearch` para encontrar nodos URL por título
