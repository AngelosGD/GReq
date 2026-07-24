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
    title.innerHTML = '<svg style="width:16px;height:16;display:inline;margin-right:6px;vertical-align:middle" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"/></svg> Servidores activos'
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
