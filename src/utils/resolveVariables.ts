export function resolveDotPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc, key) => {
    if (acc != null && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

export function resolveVariables(
  template: string,
  responses: Record<string, { status: number; statusText: string; headers: { key: string; value: string }[]; body: string }>,
  defaultNodeId?: string,
  envVars?: Record<string, string>,
): string {
  return template.replace(/\{\{(.+?)\}\}/g, (match, expr) => {
    const trimmed = expr.trim()

    if (envVars?.[trimmed] !== undefined) return envVars[trimmed]

    let sourceId: string | undefined
    let restPath: string

    if (trimmed.startsWith('$prev.') && defaultNodeId) {
      sourceId = defaultNodeId
      restPath = trimmed.slice(6)
    } else if (trimmed.startsWith('$prev')) {
      sourceId = defaultNodeId
      restPath = ''
    } else {
      const parts = trimmed.split('.')
      if (responses[parts[0]]) {
        sourceId = parts[0]
        restPath = parts.slice(1).join('.')
      } else {
        sourceId = defaultNodeId
        restPath = trimmed
      }
    }

    if (!sourceId) return match

    const response = responses[sourceId]
    if (!response) return match

    if (restPath === '' || restPath === 'body') {
      return response.body
    }

    if (restPath.startsWith('body.')) {
      const bodyPath = restPath.slice(5)
      try {
        const body = JSON.parse(response.body)
        const val = resolveDotPath(body, bodyPath)
        return val != null ? String(val) : match
      } catch {
        return match
      }
    }

    if (restPath.startsWith('headers.')) {
      const headerName = restPath.slice(8).toLowerCase()
      const header = response.headers.find((h) => h.key.toLowerCase() === headerName)
      return header?.value ?? match
    }

    if (restPath === 'status') {
      return String(response.status)
    }

    if (restPath === 'statusText') {
      return response.statusText
    }

    return match
  })
}
