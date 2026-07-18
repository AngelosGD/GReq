export function parseCurl(input: string): { method: string; url: string; headers: { key: string; value: string }[]; body: string } | null {
  const lines = input.replace(/\\\n/g, ' ').replace(/\\\r\n/g, ' ').trim()
  const tokens: string[] = []
  let current = ''
  let inQuote = false
  let quoteChar = ''
  for (const ch of lines) {
    if (inQuote) {
      if (ch === quoteChar) inQuote = false
      else current += ch
    } else if (ch === '"' || ch === "'") {
      inQuote = true; quoteChar = ch
    } else if (/\s/.test(ch)) {
      if (current) { tokens.push(current); current = '' }
    } else current += ch
  }
  if (current) tokens.push(current)

  let method = 'GET'
  let url = ''
  const headers: { key: string; value: string }[] = []
  let body = ''

  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]
    if (t === 'curl') { i++; continue }
    if (t === '-X' || t === '--request') { method = tokens[i + 1]?.toUpperCase() || 'GET'; i += 2; continue }
    if (t === '-H' || t === '--header') { const h = tokens[i + 1] ?? ''; const sep = h.indexOf(':'); if (sep > 0) headers.push({ key: h.slice(0, sep).trim(), value: h.slice(sep + 1).trim() }); i += 2; continue }
    if (t === '-d' || t === '--data' || t === '--data-raw') { body = (body ? body + '&' : '') + (tokens[i + 1] ?? ''); if (method === 'GET') method = 'POST'; i += 2; continue }
    if (t.startsWith('http://') || t.startsWith('https://')) { url = t; i++; continue }
    i++
  }

  if (!url) return null

  let path = ''
  try {
    const parsed = new URL(url)
    path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/^\//, '')
  } catch {
    return null
  }
  return { method, url: path, headers, body }
}
