import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import { getActiveServers, clearTrackedServers } from './runningServers'

export function registerCloseHandler() {
  getCurrentWindow().onCloseRequested(async (event) => {
    const servers = getActiveServers()
    if (servers.length === 0) return

    event.preventDefault()

    const msg = servers
      .map((s) => `  • ${s.name} → http://localhost:${s.port}`)
      .join('\n')

    const overlay = document.createElement('div')
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '99999',
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    })

    const box = document.createElement('div')
    Object.assign(box.style, {
      background: '#1e1e2e', color: '#cdd6f4',
      borderRadius: '12px', padding: '24px', maxWidth: '480px',
      width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    })

    box.innerHTML = `
      <h3 style="margin:0 0 12px;font-size:16px;font-weight:600">🔌 Servidores activos</h3>
      <p style="margin:0 0 8px;font-size:13px;color:#a6adc8">
        Tienes APIs de prueba corriendo en diferentes puertos:
      </p>
      <pre style="margin:0 0 16px;font-size:12px;background:#11111b;padding:12px;border-radius:8px;white-space:pre-wrap">${msg}</pre>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="ch-stop" style="flex:1;padding:8px 12px;border:none;border-radius:8px;background:#f38ba8;color:#1e1e2e;font-weight:600;cursor:pointer;font-size:13px">Cerrar y detener todas</button>
        <button id="ch-keep" style="flex:1;padding:8px 12px;border:none;border-radius:8px;background:#313244;color:#cdd6f4;cursor:pointer;font-size:13px">Cerrar y mantener abiertas</button>
        <button id="ch-cancel" style="flex:1;padding:8px 12px;border:none;border-radius:8px;background:#45475a;color:#cdd6f4;cursor:pointer;font-size:13px">Cancelar</button>
      </div>
    `

    overlay.appendChild(box)
    document.body.appendChild(overlay)

    const close = () => { overlay.remove() }

    box.querySelector('#ch-stop')!.addEventListener('click', async () => {
      close()
      await invoke('stop_all_mock_servers')
      clearTrackedServers()
      await getCurrentWindow().close()
    })

    box.querySelector('#ch-keep')!.addEventListener('click', async () => {
      close()
      await getCurrentWindow().close()
    })

    box.querySelector('#ch-cancel')!.addEventListener('click', close)
  })
}
