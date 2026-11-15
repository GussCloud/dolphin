import { lazy, Suspense, useState } from 'react'
import { UserCog } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '../ui/button'

// Why lazy: the profile screen is opened rarely; its reads run only when it opens.
const ClaudeProfileDialog = lazy(() => import('./ClaudeProfileDialog'))

export function ClaudeProfileButton(props: {
  accountId: string
  email: string
  disabled: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
        disabled={props.disabled}
        className="h-6 px-2 text-muted-foreground hover:text-foreground"
      >
        <UserCog className="size-3" />
        {translate('auto.components.settings.ClaudeProfileDialog.open', 'Profile')}
      </Button>
      {open ? (
        <Suspense fallback={null}>
          <ClaudeProfileDialog
            accountId={props.accountId}
            email={props.email}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      ) : null}
    </>
  )
}
