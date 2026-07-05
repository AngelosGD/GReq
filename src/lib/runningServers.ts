const KEY = 'greq-running-servers'

export interface RunningServer {
  id: string
  apiId: string
  name: string
  port: number
}

function all(): RunningServer[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function save(list: RunningServer[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function trackServer(s: RunningServer) {
  const list = all()
  if (!list.find((x) => x.id === s.id)) {
    list.push(s)
    save(list)
  }
}

export function untrackServer(id: string) {
  save(all().filter((s) => s.id !== id))
}

export function getActiveServers(): RunningServer[] {
  return all()
}

export function clearTrackedServers() {
  localStorage.removeItem(KEY)
}
