import { useEffect, useState } from 'react'
import { PictureInPicture2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'

/** Opens (or focuses) the standalone Design window so it can be moved to another monitor. */
export function DesignPopoutButton(): React.JSX.Element | null {
  const designs = window.api?.designs
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!designs?.onPopoutOpenChanged) {
      return
    }
    let disposed = false
    const off = designs.onPopoutOpenChanged((next) => setOpen(next))
    void designs
      .getPopoutOpen()
      .then((next) => !disposed && setOpen(next))
      .catch(() => undefined)
    return () => {
      disposed = true
      off()
    }
  }, [designs])

  // Why: the browser web client has no second window to open.
  if (!designs?.openPopout) {
    return null
  }
  // Why: a second click focuses the existing window instead of opening another one.
  const label = open
    ? translate('auto.components.design.popout.focus', 'Show the Design window')
    : translate('auto.components.design.popout.open', 'Open in new window')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={label}
          data-design-popout-button=""
          onClick={() => void designs.openPopout()}
        >
          <PictureInPicture2 />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
