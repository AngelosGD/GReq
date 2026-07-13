import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Logo } from './Logo'
import {
  signInWithEmail,
  signUpWithEmail,
  getOAuthUrl,
  completeOAuth,
  OAuthProvider,
  getCurrentUser,
  account,
} from '../lib/appwrite'
import { useAuthStore } from '../store/authStore'

type AuthMode = 'signin' | 'signup'

interface Props {
  onSuccess: () => void
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )
}

export function AuthPage({ onSuccess }: Props) {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setUser = useAuthStore((s) => s.setUser)

  async function onLoginSuccess() {
    const user = await getCurrentUser()
    if (user) setUser(user)
    onSuccess()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(name, email, password)
      }
      await onLoginSuccess()
    } catch (err: any) {
      setError(err?.message || err?.type || err?.response?.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  function deriveOAuthPassword(email: string) {
    const clean = email.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    const suffix = (clean.slice(0, 10) || 'user') + 'A1'
    return 'greq_oauth_' + suffix
  }

  async function createOrLoginWithOAuth(email: string, name: string) {
    const pwd = deriveOAuthPassword(email)
    const safeName = (name || '').trim() || email.split('@')[0] || 'Usuario'
    const safeEmail = email.trim().toLowerCase()
    try {
      await account.createEmailPasswordSession(safeEmail, pwd)
      return
    } catch {}
    await signUpWithEmail(safeName, safeEmail, pwd)
  }

  async function handleOAuth(provider: OAuthProvider) {
    setError('')
    setLoading(true)
    try {
      if (provider === OAuthProvider.Github) {
        const oauthResult = await invoke<{ email: string; name: string; accessToken: string }>('login_with_github', {
          clientId: import.meta.env.VITE_GITHUB_CLIENT_ID,
          clientSecret: import.meta.env.VITE_GITHUB_CLIENT_SECRET,
        })
        localStorage.setItem('greq-github-token', oauthResult.accessToken)
        await createOrLoginWithOAuth(oauthResult.email, oauthResult.name)
      } else if (provider === OAuthProvider.Google) {
        const oauthResult = await invoke<{ email: string; name: string }>('login_with_google', {
          clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
        })
        await createOrLoginWithOAuth(oauthResult.email, oauthResult.name)
      } else {
        const url = await getOAuthUrl(provider, 0)
        const { userId, secret } = await invoke<{ userId: string; secret: string }>('start_oauth_webview', { url })
        await completeOAuth(userId, secret)
      }
      await onLoginSuccess()
    } catch (err: any) {
      console.error('[greq] OAuth error:', err)
      const msg = typeof err === 'string' ? err : (err?.message || err?.type || 'Error al iniciar sesión con el proveedor')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-12
                    bg-gradient-to-br from-zinc-50 to-white
                    dark:from-zinc-950 dark:to-zinc-900 transition-colors duration-300">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-6">
            <Logo size={52} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">
            {mode === 'signin' ? 'Bienvenido de vuelta a GReq' : 'Crea tu cuenta en GReq'}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {mode === 'signin'
              ? 'Inicia sesión para continuar'
              : 'Regístrate para empezar'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium text-center">
            {error}
          </div>
        )}

        <div className="flex gap-3 mb-8">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuth(OAuthProvider.Google)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                       border border-zinc-300 dark:border-zinc-700
                       bg-white dark:bg-zinc-900
                       text-zinc-700 dark:text-zinc-300
                       hover:bg-zinc-50 dark:hover:bg-zinc-800
                       active:scale-[0.98] transition-all duration-200 text-sm font-medium
                       disabled:opacity-50 disabled:cursor-wait"
          >
            <GoogleIcon />
            Google
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuth(OAuthProvider.Github)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                       border border-zinc-300 dark:border-zinc-700
                       bg-white dark:bg-zinc-900
                       text-zinc-700 dark:text-zinc-300
                       hover:bg-zinc-50 dark:hover:bg-zinc-800
                       active:scale-[0.98] transition-all duration-200 text-sm font-medium
                       disabled:opacity-50 disabled:cursor-wait"
          >
            <GithubIcon />
            GitHub
          </button>
        </div>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-zinc-900 px-3 text-zinc-400 dark:text-zinc-500">
              o con correo
            </span>
          </div>
        </div>

        <div className="flex mb-8 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
          <button
            onClick={() => { setMode('signin'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              mode === 'signin'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            onClick={() => { setMode('signup'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              mode === 'signup'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Nombre
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700
                           bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white
                           placeholder:text-zinc-400 dark:placeholder:text-zinc-600
                           focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500
                           transition-all duration-200 text-sm"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Correo electrónico
            </label>
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700
                           bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white
                           placeholder:text-zinc-400 dark:placeholder:text-zinc-600
                           focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500
                           transition-all duration-200 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700
                           bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white
                           placeholder:text-zinc-400 dark:placeholder:text-zinc-600
                           focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500
                           transition-all duration-200 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold
                       bg-zinc-900 dark:bg-white text-white dark:text-zinc-900
                       hover:bg-zinc-800 dark:hover:bg-zinc-200
                       active:scale-[0.98] transition-all duration-200
                       shadow-sm shadow-zinc-900/10
                       disabled:opacity-50 disabled:cursor-wait"
          >
            {loading ? 'Cargando...' : mode === 'signin' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onSuccess}
            className="text-[11px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            Entrar como invitado
          </button>
        </div>
      </div>
    </div>
  )
}
