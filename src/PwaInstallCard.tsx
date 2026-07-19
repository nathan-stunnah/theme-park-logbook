import { useEffect, useState } from 'react'
import { getInstallPlatform, type InstallPlatform } from './pwaInstall'

type InstallChoice = {
  outcome: 'accepted' | 'dismissed'
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<InstallChoice>
}

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean
}

function readInstallPlatform(): InstallPlatform {
  const navigatorWithStandalone = navigator as NavigatorWithStandalone

  return getInstallPlatform({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    displayStandalone: window.matchMedia('(display-mode: standalone)').matches,
    navigatorStandalone: navigatorWithStandalone.standalone,
  })
}

export default function PwaInstallCard() {
  const [platform, setPlatform] = useState<InstallPlatform>(readInstallPlatform)
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [instructionsOpen, setInstructionsOpen] = useState(false)

  useEffect(() => {
    function handleInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    function handleInstalled() {
      setInstallPrompt(null)
      setInstructionsOpen(false)
      setPlatform('installed')
    }

    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function installApp() {
    if (!installPrompt) {
      setInstructionsOpen((isOpen) => !isOpen)
      return
    }

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice

    if (choice.outcome === 'accepted') setInstallPrompt(null)
  }

  const canInstallDirectly = Boolean(installPrompt)

  return (
    <section className="content-section install-section" aria-labelledby="mobile-app-title">
      <div className="install-card">
        <span className="install-icon" aria-hidden="true">📱</span>
        <div className="install-copy">
          <span className="release-label">FREE MOBILE RELEASE</span>
          <strong id="mobile-app-title">
            {platform === 'installed'
              ? 'Installed on this device'
              : 'Put Park Logbook on your Home Screen'}
          </strong>
          <p>
            {platform === 'installed'
              ? 'It now opens full-screen like an app and keeps its offline-ready logbook on this device.'
              : 'Install the web app for a full-screen icon, quick access at the park and no app-store fee.'}
          </p>
        </div>

        {platform === 'installed' ? (
          <span className="installed-badge">✓ Ready</span>
        ) : (
          <button type="button" className="button button-primary install-button" onClick={installApp}>
            {canInstallDirectly ? 'Install app' : 'How to install'}
          </button>
        )}
      </div>

      {platform !== 'installed' && instructionsOpen && (
        <div className="install-instructions" role="status">
          {platform === 'ios' ? (
            <>
              <strong>Install on iPhone or iPad</strong>
              <ol>
                <li>Open this page in Safari.</li>
                <li>Tap the Share button.</li>
                <li>Choose <b>Add to Home Screen</b>, then tap <b>Add</b>.</li>
              </ol>
            </>
          ) : platform === 'android' ? (
            <>
              <strong>Install on Android</strong>
              <ol>
                <li>Open this page in Chrome.</li>
                <li>Open the browser menu.</li>
                <li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li>
              </ol>
            </>
          ) : (
            <>
              <strong>Install on your phone</strong>
              <p>
                Open <b>theme-park-logbook.vercel.app</b> on your phone, then use Safari's
                <b> Add to Home Screen</b> or Chrome's <b>Install app</b> option.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  )
}
