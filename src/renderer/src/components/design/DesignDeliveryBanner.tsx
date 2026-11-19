import { useState } from 'react'
import { AlertTriangle, CheckCheck, Clock, LoaderCircle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { DesignDeliveryState } from './design-conversation'

/** Whether the agent has read what the user sent: waiting, not responding, or all read. */
export function DesignDeliveryBanner({
  state,
  onResend
}: {
  state: DesignDeliveryState
  onResend: () => Promise<void>
}): React.JSX.Element | null {
  const [resending, setResending] = useState(false)
  if (state.kind === 'blocked') {
    return (
      <div
        data-design-delivery="blocked"
        className="flex items-start gap-2 rounded-lg border border-status-warning-border bg-status-warning-background px-3 py-2 text-xs text-status-warning"
      >
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-medium">
            {translate('auto.components.design.delivery.blocked', 'The agent is not responding')}
          </p>
          <p className="text-muted-foreground">
            {translate(
              'auto.components.design.delivery.blockedDetail',
              'Dolphin stopped notifying it after several unread notices. Items waiting: {{value0}}.',
              { value0: state.pending }
            )}
          </p>
        </div>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={resending}
          onClick={() => {
            setResending(true)
            void onResend().finally(() => setResending(false))
          }}
        >
          {resending ? (
            <LoaderCircle className="size-3 animate-spin" />
          ) : (
            <RotateCw className="size-3" />
          )}
          {translate('auto.components.design.delivery.resend', 'Resend')}
        </Button>
      </div>
    )
  }
  if (state.kind === 'pending') {
    return (
      <div
        data-design-delivery="pending"
        className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground"
      >
        <Clock className="size-3.5 shrink-0" />
        {translate(
          'auto.components.design.delivery.pending',
          'Waiting for the agent to read. Items: {{value0}}',
          { value0: state.pending }
        )}
      </div>
    )
  }
  if (state.kind === 'idle') {
    return null
  }
  return (
    <div
      data-design-delivery="read"
      className="flex items-center gap-2 px-1 text-xs text-muted-foreground"
    >
      <CheckCheck className="size-3.5 shrink-0" />
      {translate('auto.components.design.delivery.read', 'The agent has read everything you sent')}
    </div>
  )
}
