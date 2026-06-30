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

- Nodes visuales URL + Method (GET/POST/PUT/DELETE)
- Ejecución real de requests HTTP via Rust (reqwest)
- Encadenamiento de requests con variables `{{$prev.body.path}}`
- Búsqueda y navegación de grupos con nombre
- Undo/redo, guardar/cargar flujos JSON
- Panel de configuración con headers, body, query params, auth
- Vista de respuesta con status, headers y body
