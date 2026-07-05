import { useEffect, useState } from 'react'
import { useAppStore } from './store'
import { Onboarding } from './components/Onboarding'
import { AuthPage } from './components/AuthPage'
import { MainApp } from './components/MainApp'
import { SettingsPage } from './components/SettingsPage'
import { getCurrentUser } from './lib/appwrite'
import { useAuthStore } from './store/authStore'
import { registerCloseHandler } from './lib/closeHandler'

export function App() {
  const screen = useAppStore((s) => s.screen)
  const { goToAuth, goToMain } = useAppStore()
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) {
        useAppStore.setState((s) => ({ ...s, screen: 'main' }))
        useAuthStore.getState().setUser(user)
      }
      setCheckingSession(false)
    })
    registerCloseHandler().catch(() => {})
  }, [])

  if (checkingSession) {
    return null
  }

  return (
    <div key={screen} className="screen-enter">
      {screen === 'onboarding' && <Onboarding onDone={goToAuth} />}
      {screen === 'auth' && <AuthPage onSuccess={goToMain} />}
      {screen === 'main' && <MainApp />}
      {screen === 'settings' && <SettingsPage />}
    </div>
  )
}
