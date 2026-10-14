import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { AzureDevOpsBoardPullRequest } from '../../../../shared/azure-devops-pull-request-board'
import { buildAzureReviewRequest } from './azure-pr-review-request'

export function AzureReviewRequestDialog({
  open,
  pullRequests,
  onOpenChange,
  onCopied
}: {
  open: boolean
  pullRequests: AzureDevOpsBoardPullRequest[]
  onOpenChange: (open: boolean) => void
  // Called only once the text actually reached the clipboard.
  onCopied?: () => void
}): React.JSX.Element {
  const [text, setText] = useState('')

  // Why: the text is editable state, so only opening rebuilds it — rebuilding per render would undo each keystroke.
  useEffect(() => {
    if (open) {
      setText(buildAzureReviewRequest(pullRequests))
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- the draft is rebuilt on open only.
  }, [open])

  const copy = async (): Promise<void> => {
    try {
      await window.api.ui.writeClipboardText(text)
    } catch {
      toast.error(
        translate(
          'auto.components.azurePrs.reviewRequest.copyFailed',
          'Could not copy. Select the text and press Ctrl+C.'
        )
      )
      return
    }
    toast.success(
      pullRequests.length === 1
        ? translate(
            'auto.components.azurePrs.reviewRequest.copiedOne',
            'Text copied — just paste it into Teams'
          )
        : translate(
            'auto.components.azurePrs.reviewRequest.copiedMany',
            'Text with {{value0}} PRs copied — just paste it into Teams',
            { value0: pullRequests.length }
          )
    )
    onOpenChange(false)
    onCopied?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {translate('auto.components.azurePrs.reviewRequest.title', 'Review request')}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.azurePrs.reviewRequest.description',
              'Plain text, the way Teams pastes it. You can edit it before copying.'
            )}
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          spellCheck={false}
          className="scrollbar-sleek h-72 w-full resize-none rounded-md border border-input bg-transparent p-3 font-mono text-xs leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {translate('auto.components.azurePrs.reviewRequest.close', 'Close')}
          </Button>
          <Button onClick={() => void copy()} disabled={text.trim().length === 0}>
            <Copy className="size-3.5" />
            {translate('auto.components.azurePrs.reviewRequest.copy', 'Copy text')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
