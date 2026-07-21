import { getCurrentWindow } from '@tauri-apps/api/window'
import { invokeWithTimeout } from './tauri'
import { getActiveServers, clearTrackedServers } from './runningServers'

export async function registerCloseHandler() {
  const unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
    const servers = getActiveServers()
    if (servers.length === 0) return

    event.preventDefault()

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

    const title = document.createElement('h3')
    Object.assign(title.style, { margin: '0 0 12px', fontSize: '16px', fontWeight: '600' })
    title.textContent = '🔌 Servidores activos'
    box.appendChild(title)

    const desc = document.createElement('p')
    Object.assign(desc.style, { margin: '0 0 8px', fontSize: '13px', color: '#a6adc8' })
    desc.textContent = 'Tienes APIs de prueba corriendo en diferentes puertos:'
    box.appendChild(desc)

    const pre = document.createElement('pre')
    Object.assign(pre.style, { margin: '0 0 16px', fontSize: '12px', background: '#11111b', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap' })
    pre.textContent = servers.map((s) => `  • ${s.name} → http://localhost:${s.port}`).join('\n')
    box.appendChild(pre)

    const btnRow = document.createElement('div')
    Object.assign(btnRow.style, { display: 'flex', gap: '8px', flexWrap: 'wrap' })

    const btnStop = document.createElement('button')
    btnStop.id = 'ch-stop'
    btnStop.textContent = 'Cerrar y detener todas'
    Object.assign(btnStop.style, { flex: '1', padding: '8px 12px', border: 'none', borderRadius: '8px', background: '#f38ba8', color: '#1e1e2e', fontWeight: '600', cursor: 'pointer', fontSize: '13px' })
    btnRow.appendChild(btnStop)

    const btnKeep = document.createElement('button')
    btnKeep.id = 'ch-keep'
    btnKeep.textContent = 'Cerrar y mantener abiertas'
    Object.assign(btnKeep.style, { flex: '1', padding: '8px 12px', border: 'none', borderRadius: '8px', background: '#313244', color: '#cdd6f4', cursor: 'pointer', fontSize: '13px' })
    btnRow.appendChild(btnKeep)

    const btnCancel = document.createElement('button')
    btnCancel.id = 'ch-cancel'
    btnCancel.textContent = 'Cancelar'
    Object.assign(btnCancel.style, { flex: '1', padding: '8px 12px', border: 'none', borderRadius: '8px', background: '#45475a', color: '#cdd6f4', cursor: 'pointer', fontSize: '13px' })
    btnRow.appendChild(btnCancel)

    box.appendChild(btnRow)
    overlay.appendChild(box)
    document.body.appendChild(overlay)

    const close = () => { overlay.remove() }

    btnStop.addEventListener('click', async () => {
      close()
      unlisten()
      await invokeWithTimeout('stop_all_mock_servers')
      clearTrackedServers()
      await getCurrentWindow().close()
    })

    btnKeep.addEventListener('click', async () => {
      close()
      unlisten()
      await getCurrentWindow().close()
    })

    btnCancel.addEventListener('click', close)
  })
}
