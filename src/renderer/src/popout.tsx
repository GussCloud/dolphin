// Why first, and why the import-free shim: react-dom reads
// __REACT_DEVTOOLS_GLOBAL_HOOK__ once at module evaluation, so the global has to
// exist before it. The observer below only wraps a property react-dom re-reads
// per commit, so its own import graph can evaluate whenever it likes.
import './lib/react-devtools-commit-hook-shim'
import './lib/react-commit-cascade-observer'
import './assets/main.css'

import { StrictMode } from 'react'
import { useTranslation } from 'react-i18next'
import { DashboardPopoutRoot } from './components/dashboard-popout/DashboardPopoutRoot'
import { RecoverableRenderErrorBoundary } from './components/error-boundaries/RecoverableRenderErrorBoundary'
import {
  installRendererCrashDiagnostics,
  recordRendererCrashBreadcrumb
} from './lib/crash-diagnostics'
import { seedPopoutWindowSettings, usePopoutWindowSettingsSync } from './lib/popout-window-settings'
import { I18nProvider } from './i18n/I18nProvider'
import { translate } from './i18n/i18n'
import { getOrCreateRendererRoot } from './lib/react-renderer-root'
import { setReactCommitCascadeRendererSurface } from './lib/react-commit-cascade-telemetry'
import { installBodyOverlayAttributes } from './lib/body-overlay-attributes'

const disposeBodyOverlayAttributes = installBodyOverlayAttributes()
import.meta.hot?.dispose(disposeBodyOverlayAttributes)

// Why: the pop-out window is a separate BrowserWindow with its own React root,
// so it must run the same renderer bootstrap as main.tsx (crash diagnostics,
// theme, i18n, error boundary) rather than inheriting anything from the main
// window. It shares the preload/window.api but not the DOM or JS context.
recordRendererCrashBreadcrumb('popout_bootstrap_started', { dev: import.meta.env.DEV })
installRendererCrashDiagnostics('dashboard-popout')
setReactCommitCascadeRendererSurface('dashboard-popout')

seedPopoutWindowSettings()

const rootElement = document.getElementById('root')
if (!rootElement) {
  recordRendererCrashBreadcrumb('popout_root_missing')
  throw new Error('Pop-out root element not found.')
}

function PopoutSettingsSync(): null {
  usePopoutWindowSettingsSync()
  return null
}

function PopoutRoot(): React.JSX.Element {
  useTranslation()
  return (
    <RecoverableRenderErrorBoundary
      boundaryId="dashboard-popout.root"
      surface="dashboard-popout"
      title={translate('dashboardPopout.recoverableError.title', 'Dolphin dashboard hit an error.')}
      description={translate(
        'dashboardPopout.recoverableError.description',
        'The dashboard could not finish rendering. Retry to remount it, or reopen it.'
      )}
    >
      <DashboardPopoutRoot />
    </RecoverableRenderErrorBoundary>
  )
}

getOrCreateRendererRoot(rootElement, import.meta.hot?.data).render(
  <StrictMode>
    <I18nProvider>
      <PopoutSettingsSync />
      <PopoutRoot />
    </I18nProvider>
  </StrictMode>
)
recordRendererCrashBreadcrumb('popout_bootstrap_rendered')
