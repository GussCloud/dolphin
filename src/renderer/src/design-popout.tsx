// Why first: react-dom reads __REACT_DEVTOOLS_GLOBAL_HOOK__ once at module evaluation (see popout.tsx).
import './lib/react-devtools-commit-hook-shim'
import './lib/react-commit-cascade-observer'
import './assets/main.css'

import { StrictMode } from 'react'
import { useTranslation } from 'react-i18next'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ConfirmationDialogProvider } from './components/confirmation-dialog'
import DesignPage from './components/design/DesignPage'
import {
  DesignHostActionsContext,
  popoutDesignHostActions
} from './components/design/design-host-actions'
import { useDesignPopoutHostSync } from './components/design/design-popout-host-sync'
import { RecoverableRenderErrorBoundary } from './components/error-boundaries/RecoverableRenderErrorBoundary'
import { useAppMenuPaste } from './hooks/useAppMenuPaste'
import { useAppMenuSelectionActions } from './hooks/useAppMenuSelectionActions'
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

// Why: a separate BrowserWindow with its own React root and store; it shares only the preload/window.api.
recordRendererCrashBreadcrumb('design_popout_bootstrap_started', { dev: import.meta.env.DEV })
installRendererCrashDiagnostics('design-popout')
setReactCommitCascadeRendererSurface('design-popout')
seedPopoutWindowSettings()

const rootElement = document.getElementById('root')
if (!rootElement) {
  recordRendererCrashBreadcrumb('design_popout_root_missing')
  throw new Error('Design pop-out root element not found.')
}

function DesignPopoutServices(): null {
  usePopoutWindowSettingsSync()
  useDesignPopoutHostSync()
  // Why: no App shell here, so nothing else would turn the Edit-menu IPC into paste/copy for text fields.
  useAppMenuPaste()
  useAppMenuSelectionActions()
  return null
}

function DesignPopoutRoot(): React.JSX.Element {
  useTranslation()
  return (
    <RecoverableRenderErrorBoundary
      boundaryId="design-popout.root"
      surface="design-popout"
      title={translate('designPopout.recoverableError.title', 'Dolphin Design hit an error.')}
      description={translate(
        'designPopout.recoverableError.description',
        'The Design window could not finish rendering. Retry to remount it, or reopen it.'
      )}
    >
      <DesignHostActionsContext.Provider value={popoutDesignHostActions}>
        <TooltipProvider delayDuration={400}>
          <ConfirmationDialogProvider>
            <div className="flex h-screen min-h-0 flex-col bg-background">
              <DesignPage />
            </div>
          </ConfirmationDialogProvider>
        </TooltipProvider>
        <Toaster closeButton toastOptions={{ className: 'font-sans text-sm' }} />
      </DesignHostActionsContext.Provider>
    </RecoverableRenderErrorBoundary>
  )
}

getOrCreateRendererRoot(rootElement, import.meta.hot?.data).render(
  <StrictMode>
    <I18nProvider>
      <DesignPopoutServices />
      <DesignPopoutRoot />
    </I18nProvider>
  </StrictMode>
)
recordRendererCrashBreadcrumb('design_popout_bootstrap_rendered')
