import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import type { HostedReviewMergeStrategy } from '../../../../../shared/hosted-review-actions'

function strategyLabel(strategy: HostedReviewMergeStrategy): string {
  switch (strategy) {
    case 'merge':
      return translate(
        'auto.components.right.sidebar.hostedReviewDetails.strategyMerge',
        'Merge (no fast-forward)'
      )
    case 'squash':
      return translate(
        'auto.components.right.sidebar.hostedReviewDetails.strategySquash',
        'Squash commit'
      )
    case 'rebase':
      return translate(
        'auto.components.right.sidebar.hostedReviewDetails.strategyRebase',
        'Rebase and fast-forward'
      )
    case 'rebase-merge':
      return translate(
        'auto.components.right.sidebar.hostedReviewDetails.strategyRebaseMerge',
        'Semi-linear merge'
      )
  }
}

export function HostedReviewCompleteDialog(props: {
  open: boolean
  strategies: HostedReviewMergeStrategy[]
  busy: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (options: {
    mergeStrategy: HostedReviewMergeStrategy
    deleteSourceBranch: boolean
  }) => void
}): React.JSX.Element {
  const [strategy, setStrategy] = useState<HostedReviewMergeStrategy>(
    props.strategies.includes('squash') ? 'squash' : (props.strategies[0] ?? 'merge')
  )
  const [deleteSourceBranch, setDeleteSourceBranch] = useState(true)
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {translate(
              'auto.components.right.sidebar.hostedReviewDetails.completeTitle',
              'Complete pull request'
            )}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.right.sidebar.hostedReviewDetails.completeDescription',
              'Merge the source branch into the target branch. Branch policies still apply.'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>
              {translate(
                'auto.components.right.sidebar.hostedReviewDetails.mergeType',
                'Merge type'
              )}
            </Label>
            <Select
              value={strategy}
              onValueChange={(value) => {
                const next = props.strategies.find((candidate) => candidate === value)
                if (next) {
                  setStrategy(next)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {props.strategies.map((candidate) => (
                  <SelectItem key={candidate} value={candidate}>
                    {strategyLabel(candidate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="hosted-review-delete-source-branch"
              checked={deleteSourceBranch}
              onCheckedChange={(checked) => setDeleteSourceBranch(checked === true)}
            />
            <Label htmlFor="hosted-review-delete-source-branch">
              {translate(
                'auto.components.right.sidebar.hostedReviewDetails.deleteSourceBranch',
                'Delete source branch after merging'
              )}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            {translate('auto.components.right.sidebar.hostedReviewDetails.cancel', 'Cancel')}
          </Button>
          <Button
            disabled={props.busy}
            onClick={() => props.onComplete({ mergeStrategy: strategy, deleteSourceBranch })}
          >
            {translate(
              'auto.components.right.sidebar.hostedReviewDetails.completeMerge',
              'Complete merge'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
