import { useEffect, useRef, useState } from 'react'
import { Globe, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { AzureCliSignInMode, AzureCliSignInState } from '../../../../shared/azure-devops-auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { AzureDevOpsLogo } from './AzureDevOpsLogo'
import { resolveAzureDevOpsSignInNoticePosition } from './azure-devops-sign-in-notice-position'
import { useAzureCliSignInState } from './use-azure-cli-sign-in-notice'

function noticeLabel(state: AzureCliSignInState): string {
  switch (state.kind) {
    case 'signing-in':
      return state.mode === 'in-app'
        ? translate(
            'auto.components.azureDevOpsSignInNotice.signingInApp',
            'Signing in to Azure DevOps in a Dolphin window…'
          )
        : translate(
            'auto.components.azureDevOpsSignInNotice.signingInBrowser',
            'Signing in to Azure DevOps in your browser…'
          )
    case 'failed':
      return translate(
        'auto.components.azureDevOpsSignInNotice.failed',
        'Azure DevOps sign-in failed: {{value0}}. Click to retry.',
        { value0: state.error }
      )
    case 'idle':
    case 'required':
      return translate(
        'auto.components.azureDevOpsSignInNotice.required',
        'Azure DevOps sign-in expired. Click to sign in.'
      )
  }
}

function startSignIn(mode: AzureCliSignInMode): void {
  const api = window.api?.azureDevOps
  if (!api?.startCliSignIn) {
    return
  }
  const reportFailure = (error: string): void => {
    toast.error(
      translate(
        'auto.components.azureDevOpsSignInNotice.toastFailed',
        'Azure DevOps sign-in failed: {{value0}}',
        { value0: error }
      ),
      {
        description: translate(
          'auto.components.azureDevOpsSignInNotice.toastHint',
          'If your organization blocks sign-in inside Dolphin, right-click the Azure DevOps icon and choose Open in system browser.'
        )
      }
    )
  }
  void api
    .startCliSignIn(mode)
    .then((result) => {
      if (!result.ok && result.error !== 'cancelled') {
        reportFailure(result.error)
      }
    })
    .catch((error: unknown) =>
      reportFailure(error instanceof Error ? error.message : String(error))
    )
}

function useNoticePosition(floatingToggleShown: boolean): { left: number; top: number } {
  const [position, setPosition] = useState(() =>
    resolveAzureDevOpsSignInNoticePosition(floatingToggleShown)
  )
  useEffect(() => {
    const update = (): void =>
      setPosition(resolveAzureDevOpsSignInNoticePosition(floatingToggleShown))
    update()
    // Why pointerup: re-stack once the user finishes dragging the toggle away.
    window.addEventListener('resize', update)
    window.addEventListener('pointerup', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('pointerup', update)
    }
  }, [floatingToggleShown])
  return position
}

function SignInNoticeButton({
  state,
  floatingToggleShown
}: {
  state: AzureCliSignInState
  floatingToggleShown: boolean
}): React.JSX.Element {
  const position = useNoticePosition(floatingToggleShown)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPoint, setMenuPoint] = useState({ x: 0, y: 0 })
  const reopenFrameRef = useRef<number | null>(null)
  const signingIn = state.kind === 'signing-in'
  const label = noticeLabel(state)

  useEffect(
    () => () => {
      if (reopenFrameRef.current !== null) {
        window.cancelAnimationFrame(reopenFrameRef.current)
      }
    },
    []
  )

  return (
    <>
      <span
        // Why: one tier above the floating toggle (z-[46]) so the menu trigger stays reachable.
        className="fixed z-[46]"
        style={{ left: position.left, top: position.top }}
        data-azure-devops-sign-in-notice={state.kind}
        onContextMenu={(event) => {
          // Why: match the floating toggle's cursor-anchored DropdownMenu right-click.
          event.preventDefault()
          event.stopPropagation()
          setMenuPoint({ x: event.clientX, y: event.clientY })
          setMenuOpen(false)
          if (reopenFrameRef.current !== null) {
            window.cancelAnimationFrame(reopenFrameRef.current)
          }
          reopenFrameRef.current = window.requestAnimationFrame(() => {
            reopenFrameRef.current = null
            setMenuOpen(true)
          })
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="launcher"
              size="icon"
              className="relative aria-disabled:cursor-progress"
              aria-label={label}
              // Why aria-disabled, not disabled: a disabled button swallows the right-click that offers Cancel.
              aria-disabled={signingIn}
              aria-busy={signingIn}
              onClick={() => {
                if (!signingIn) {
                  startSignIn('in-app')
                }
              }}
            >
              {signingIn ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <AzureDevOpsLogo className="size-4" />
              )}
              {state.kind === 'required' ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-1 top-1 size-2 rounded-full bg-status-warning ring-2 ring-card dark:ring-accent"
                />
              ) : null}
              {state.kind === 'failed' ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-1 top-1 size-2 rounded-full bg-destructive ring-2 ring-card dark:ring-accent"
                />
              ) : null}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={6}>
            {label}
          </TooltipContent>
        </Tooltip>
      </span>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            aria-hidden
            tabIndex={-1}
            className="pointer-events-none fixed size-px opacity-0"
            style={{ left: menuPoint.x, top: menuPoint.y }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" sideOffset={0} align="start">
          {signingIn ? (
            <DropdownMenuItem
              className="whitespace-nowrap"
              onSelect={() => {
                void window.api?.azureDevOps?.cancelCliSignIn?.()
              }}
            >
              <X className="size-3.5" />
              {translate('auto.components.azureDevOpsSignInNotice.cancel', 'Cancel sign-in')}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="whitespace-nowrap"
              onSelect={() => startSignIn('system-browser')}
            >
              <Globe className="size-3.5" />
              {translate(
                'auto.components.azureDevOpsSignInNotice.systemBrowser',
                'Open in system browser'
              )}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

export function AzureDevOpsSignInNotice({
  floatingToggleShown
}: {
  floatingToggleShown: boolean
}): React.JSX.Element | null {
  const state = useAzureCliSignInState()
  if (!state || state.kind === 'idle') {
    return null
  }
  return <SignInNoticeButton state={state} floatingToggleShown={floatingToggleShown} />
}
