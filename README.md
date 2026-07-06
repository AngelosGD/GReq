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

- **Peticiones HTTP** — Nodos URL + Method (GET/POST/DELETE/UPDATE) arrastrables al canvas, ejecución en cadena con `repeatCount`
- **Variables dinámicas** — `{{$prev.body.path}}`, `{{$prev.headers.X}}`, `{{$prev.status}}`, `{{nodeId.body.path}}`
- **Agrupación** — Nodos URL con nombre + métodos conectados, guardados en historial (`greq-history`, 20)
- **Historial** — Modal con grupos guardados, retomar o eliminar
- **Servidor Mock inteligente** — Panel de APIs de prueba con servidor Rust/axum. Crea APIs con campos tipados y datos de ejemplo; el backend responde según el método (GET lista/individual, POST crea con ID, DELETE/PUT/PATCH actualizan), status y body editables
- **Sample data multi-registro** — Editor tabular de registros de ejemplo que el mock sirve en GET
- **Onboarding** — 3 slides con video e imágenes
- **Undo/redo** — 50 snapshots, Ctrl+Z / Ctrl+Shift+Z
- **Guardar/cargar** — Flujos completos en JSON
- **Búsqueda de grupos** — `NodeSearch` para encontrar nodos URL por título
