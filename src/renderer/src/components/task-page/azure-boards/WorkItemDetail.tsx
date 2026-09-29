import { useState } from 'react'
import { ExternalLink, LoaderCircle, Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import {
  azureBoardsWorkItemIdentifier,
  type AzureBoardsWorkItemDetail
} from '../../../../../shared/azure-boards-types'
import type { AzureBoardsTasksState } from './use-azure-boards-tasks'

/** Azure DevOps stores rich text as HTML; show it as plain text without rendering markup. */
export function azureBoardsHtmlToText(html: string): string {
  const withBreaks = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n')
  const text = new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent ?? ''
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

function CommentForm(props: {
  disabled: boolean
  onSubmit: (text: string) => Promise<boolean>
}): React.JSX.Element {
  const [text, setText] = useState('')
  return (
    <form
      className="space-y-1.5"
      onSubmit={(event) => {
        event.preventDefault()
        void props.onSubmit(text.trim()).then((ok) => ok && setText(''))
      }}
    >
      <Textarea
        rows={2}
        value={text}
        disabled={props.disabled}
        placeholder={translate(
          'auto.components.taskPage.azureBoards.commentPlaceholder',
          'Add a comment'
        )}
        aria-label={translate(
          'auto.components.taskPage.azureBoards.commentPlaceholder',
          'Add a comment'
        )}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex justify-end">
        <Button type="submit" size="xs" disabled={props.disabled || !text.trim()}>
          {translate('auto.components.taskPage.azureBoards.comment', 'Comment')}
        </Button>
      </div>
    </form>
  )
}

export function AzureBoardsWorkItemDetailView(props: {
  state: AzureBoardsTasksState
  detail: AzureBoardsWorkItemDetail
  onStartWorkspace: (item: AzureBoardsWorkItemDetail) => void
}): React.JSX.Element {
  const { state, detail } = props
  const description = azureBoardsHtmlToText(detail.description)
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-auto scrollbar-sleek p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">
            {`${detail.workItemType} ${azureBoardsWorkItemIdentifier(detail.id)}`}
          </p>
          <h2 className="text-sm font-medium text-foreground">{detail.title}</h2>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={translate('auto.components.taskPage.azureBoards.close', 'Close')}
          onClick={() => state.select(null)}
        >
          <X />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs" onClick={() => props.onStartWorkspace(detail)}>
          <Play />
          {translate('auto.components.taskPage.azureBoards.startWorkspace', 'Start workspace')}
        </Button>
        <Button variant="outline" size="xs" onClick={() => window.api.shell.openUrl(detail.url)}>
          <ExternalLink />
          {translate('auto.components.taskPage.azureBoards.openInBrowser', 'Open in Azure DevOps')}
        </Button>
        {detail.states.length > 0 ? (
          <Select
            value={detail.state}
            disabled={state.mutating}
            onValueChange={(next) => void state.updateState(detail.id, next)}
          >
            <SelectTrigger
              size="sm"
              aria-label={translate('auto.components.taskPage.azureBoards.state', 'State')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {detail.states.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {state.mutating ? (
          <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      <p className="text-[12px] text-muted-foreground">
        {detail.assignedTo
          ? translate('auto.components.taskPage.azureBoards.assignedTo', 'Assigned to {{value0}}', {
              value0: detail.assignedTo
            })
          : translate('auto.components.taskPage.azureBoards.unassigned', 'Unassigned')}
      </p>
      <p className="whitespace-pre-wrap break-words text-[12px] text-foreground">
        {description ||
          translate('auto.components.taskPage.azureBoards.noDescription', 'No description.')}
      </p>
      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {translate('auto.components.taskPage.azureBoards.comments', 'Comments')}
        </h3>
        {detail.comments.map((comment) => (
          <div key={comment.id} className="text-[12px]">
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{comment.author}</span>{' '}
              {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}
            </p>
            <p className="whitespace-pre-wrap break-words text-foreground">
              {azureBoardsHtmlToText(comment.text)}
            </p>
          </div>
        ))}
        <CommentForm
          disabled={state.mutating}
          onSubmit={(text) => state.addComment(detail.id, text)}
        />
      </section>
    </div>
  )
}
