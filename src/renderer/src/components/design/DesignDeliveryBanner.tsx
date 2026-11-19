import { useState } from 'react'
import { AlertTriangle, BellRing, CheckCheck, Clock, LoaderCircle, RotateCw } from 'lucide-react'
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
        <ResendButton
          onResend={onResend}
          icon={<RotateCw className="size-3" />}
          label={translate('auto.components.design.delivery.resend', 'Resend')}
        />
      </div>
    )
  }
  if (state.kind === 'pending') {
    const waiting = translate(
      'auto.components.design.delivery.pending',
      'Waiting for the agent to read. Items: {{value0}}',
      { value0: state.pending }
    )
    if (state.offerNotifyNow) {
      return (
        <div
          data-design-delivery="pending-unnotified"
          className="flex items-start gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground"
        >
          <Clock className="mt-0.5 size-3.5 shrink-0" />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p>{waiting}</p>
            <p>
              {translate(
                'auto.components.design.delivery.notifyHint',
                'Dolphin notifies the agent when it becomes free. If this agent does not report that, notify it now.'
              )}
            </p>
          </div>
          <ResendButton
            onResend={onResend}
            icon={<BellRing className="size-3" />}
            label={translate('auto.components.design.delivery.notifyNow', 'Notify now')}
          />
        </div>
      )
    }
    return (
      <div
        data-design-delivery="pending"
        className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground"
      >
        <Clock className="size-3.5 shrink-0" />
        {waiting}
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

function ResendButton({
  onResend,
  icon,
  label
}: {
  onResend: () => Promise<void>
  icon: React.JSX.Element
  label: string
}): React.JSX.Element {
  const [resending, setResending] = useState(false)
  return (
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
      {resending ? <LoaderCircle className="size-3 animate-spin" /> : icon}
      {label}
    </Button>
  )
}
