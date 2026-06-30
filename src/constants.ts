export type PaletteKey = 'url' | 'get' | 'post' | 'delete' | 'update'

export interface Palette {
  from: string
  to: string
  dot: string
  border: string
  label: string
}

export const palettes: Record<PaletteKey, Palette> = {
  url:    { from: '#34d399', to: '#059669', dot: '#10b981', border: 'rgba(16,185,129,0.2)', label: 'URL' },
  get:    { from: '#34d399', to: '#059669', dot: '#10b981', border: 'rgba(16,185,129,0.2)', label: 'GET' },
  post:   { from: '#60a5fa', to: '#2563eb', dot: '#3b82f6', border: 'rgba(59,130,246,0.2)', label: 'POST' },
  delete: { from: '#f87171', to: '#dc2626', dot: '#ef4444', border: 'rgba(239,68,68,0.2)', label: 'DELETE' },
  update: { from: '#fbbf24', to: '#d97706', dot: '#f59e0b', border: 'rgba(245,158,11,0.2)', label: 'UPDATE' },
}

export const methodLabels: Record<string, string> = {
  GET: 'get', POST: 'post', DELETE: 'delete', UPDATE: 'update',
}
