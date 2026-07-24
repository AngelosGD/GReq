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
npm run tauri build                                    # 64-bit
npm run tauri build -- --target i686-pc-windows-msvc   # 32-bit (rustup target add i686-pc-windows-msvc)
```

## Características

- **Editor visual de flujos** — Nodos URL + Method (GET/POST/PUT/PATCH/DELETE/UPDATE) arrastrables al canvas, ejecución en cadena con `repeatCount`
- **Variables dinámicas** — `{{$prev.body.path}}`, `{{$prev.headers.X}}`, `{{$prev.status}}`, `{{nodeId.body.path}}`
- **Historial** — Grupos guardados automáticamente al nombrar un nodo URL, retomar o eliminar desde modal
- **Autenticación** — Email/password (Appwrite) y OAuth directo por navegador (GitHub, Google)
- **Importación desde GitHub** — Sidebar con repositorios importados, detección de endpoints, árbol expandible, panel de detalle + botón "Llevar a diagrama"
- **Servidor Mock inteligente** — APIs de prueba con Rust/axum. Crea APIs con campos tipados y datos de ejemplo. GET lista/individual, POST crea con ID, DELETE/PUT/PATCH actualizan. Status, body y headers editables por método
- **Asistente IA** — Chat lateral que genera flujos completos de API desde descripción en lenguaje natural
- **Undo/redo** — 50 snapshots, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
- **Guardar/cargar** — Flujos completos en JSON
- **Búsqueda de grupos** — Buscador de nodos URL por título con expansión de métodos anidados
- **Onboarding** — 3 slides interactivos con video e imágenes
- **Diseño moderno** — Paleta Zinc + Emerald, sombras tintadas, anillos de foco unificados, modo oscuro compatibilidad total
