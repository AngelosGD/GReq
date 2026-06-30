import { useAppStore } from './store'
import { Onboarding } from './components/Onboarding'
import { AuthPage } from './components/AuthPage'
import { MainApp } from './components/MainApp'
import { SettingsPage } from './components/SettingsPage'

export function App() {
  const screen = useAppStore((s) => s.screen)
  const { goToAuth, goToMain } = useAppStore()

  return (
    <div key={screen} className="screen-enter">
      {screen === 'onboarding' && <Onboarding onDone={goToAuth} />}
      {screen === 'auth' && <AuthPage onSuccess={goToMain} />}
      {screen === 'main' && <MainApp />}
      {screen === 'settings' && <SettingsPage />}
    </div>
  )
}
