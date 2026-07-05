import { type ReactNode, useState } from 'react'
import { useAppStore } from '../store'
import { useAuthStore } from '../store/authStore'

export function AuthGuard({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  const user = useAuthStore((s) => s.user)
  const goToAuth = useAppStore((s) => s.goToAuth)
  const [showPrompt, setShowPrompt] = useState(false)

  if (user) return <>{children}</>

  return (
    <>
      <div className="relative" onClick={() => setShowPrompt(true)}>
        <div className="pointer-events-none">{children}</div>
        <div className="absolute inset-0 cursor-pointer" />
      </div>
      {showPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setShowPrompt(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-zinc-200/80 w-full max-w-xs p-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-zinc-800 mb-1">Función bloqueada</p>
            <p className="text-[11px] text-zinc-500 mb-4">
              {label}
            </p>
            <button
              onClick={() => { setShowPrompt(false); goToAuth() }}
              className="w-full py-2 rounded-xl text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] transition-all"
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => setShowPrompt(false)}
              className="w-full py-2 mt-1.5 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-all"
            >
              Ahora no
            </button>
          </div>
        </div>
      )}
    </>
  )
}
