import type { FieldDef } from '../components/mockApi/types'

const PRODUCT_NAMES = ['Laptop Gamer','Teclado Mecánico','Monitor 27"','Mouse Inalámbrico','Audífonos Bluetooth','Tablet 10"','Cámara Digital','Impresora Láser','Router WiFi','Altavoz Portátil']
const USER_NAMES = ['Carlos Mendoza','Ana García','Luis Fernández','María López','Pedro Sánchez','Sofía Torres','Diego Ramírez','Valentina Ortiz','Mateo Herrera','Isabella Castro']
const PRODUCT_DESCS = ['Producto de alta calidad','Modelo profesional 2024','Versión estándar','Edición premium','Color negro mate','Nuevo modelo mejorado']
const USER_DOMAINS = ['gmail.com','outlook.com','corp.io','demo.org','test.io']

export function generateValue(f: FieldDef, index: number): string {
  const name = f.name.toLowerCase()
  if (f.type === 'int') return String(name.includes('precio') || name.includes('price') || name.includes('pvp') ? Math.floor(Math.random() * 900) + 10 : name.includes('edad') || name.includes('age') ? String(Math.floor(Math.random() * 50) + 18) : Math.floor(Math.random() * 1000) + 1)
  if (f.type === 'float') return (Math.random() * 10000).toFixed(2)
  if (f.type === 'bool') return Math.random() > 0.5 ? 'true' : 'false'
  if (name.includes('email') || name.includes('correo')) return `user${index + 1}@${USER_DOMAINS[index % USER_DOMAINS.length]}`
  if (name.includes('descripcion') || name.includes('description') || name.includes('cuerpo') || name.includes('body') || name.includes('detalle')) { const v = PRODUCT_DESCS[index % PRODUCT_DESCS.length]; return f.maxLength ? v.slice(0, f.maxLength) : v }
  if (name.includes('nombre') || name.includes('name') || name.includes('titulo') || name.includes('title')) { const pool = name.includes('usuari') || name.includes('cliente') || name.includes('autor') ? USER_NAMES : PRODUCT_NAMES; const v = pool[index % pool.length]; return f.maxLength ? v.slice(0, f.maxLength) : v }
  const pool = name.includes('usuari') || name.includes('cliente') || name.includes('autor') ? USER_NAMES : PRODUCT_NAMES
  const v = pool[index % pool.length]
  return f.maxLength ? v.slice(0, f.maxLength) : v
}

export function generateRows(fields: FieldDef[], count: number): Record<string, string>[] {
  const rows: Record<string, string>[] = []
  for (let i = 0; i < count; i++) {
    const row: Record<string, string> = {}
    for (const f of fields) row[f.name] = generateValue(f, i)
    rows.push(row)
  }
  return rows
}
