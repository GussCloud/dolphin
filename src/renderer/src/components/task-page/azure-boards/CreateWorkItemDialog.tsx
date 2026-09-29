import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import type { AzureBoardsTasksState } from './use-azure-boards-tasks'

export function AzureBoardsCreateWorkItemDialog(props: {
  state: AzureBoardsTasksState
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { state } = props
  const [types, setTypes] = useState<string[]>([])
  const [workItemType, setWorkItemType] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { listTypes } = state

  useEffect(() => {
    let cancelled = false
    void listTypes()
      .then((next) => {
        if (!cancelled) {
          setTypes(next)
          setWorkItemType(
            (current) => current || (next.includes('Task') ? 'Task' : (next[0] ?? ''))
          )
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught))
        }
      })
    return () => {
      cancelled = true
    }
  }, [listTypes])

  const submit = async (): Promise<void> => {
    const ok = await state.create({
      workItemType,
      title: title.trim(),
      ...(description.trim() ? { description: description.trim() } : {})
    })
    if (ok) {
      props.onOpenChange(false)
    }
  }

  return (
    <Dialog open onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {translate('auto.components.taskPage.azureBoards.createTitle', 'New work item')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="space-y-1.5">
            <Label>{translate('auto.components.taskPage.azureBoards.type', 'Type')}</Label>
            <Select value={workItemType} onValueChange={setWorkItemType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {types.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="azure-boards-new-title">
              {translate('auto.components.taskPage.azureBoards.titleLabel', 'Title')}
            </Label>
            <Input
              id="azure-boards-new-title"
              value={title}
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="azure-boards-new-description">
              {translate('auto.components.taskPage.azureBoards.descriptionLabel', 'Description')}
            </Label>
            <Textarea
              id="azure-boards-new-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
              {translate('auto.components.taskPage.azureBoards.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={state.mutating || !title.trim() || !workItemType}>
              {translate('auto.components.taskPage.azureBoards.create', 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
