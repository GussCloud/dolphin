import { useState } from 'react'
import { Kanban, LoaderCircle, Play, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import {
  azureBoardsWorkItemIdentifier,
  type AzureBoardsWorkItem
} from '../../../../../shared/azure-boards-types'
import { normalizeTaskSourceContext } from '../../../../../shared/task-source-context'
import type { TaskPageComposerActionsModel } from '../../use-task-page-composer-actions'
import { AzureBoardsCreateWorkItemDialog } from './CreateWorkItemDialog'
import { useAzureBoardsTasks, type AzureBoardsTasksState } from './use-azure-boards-tasks'
import { AzureBoardsWorkItemDetailView } from './WorkItemDetail'

function Toolbar(props: { state: AzureBoardsTasksState; onCreate: () => void }): React.JSX.Element {
  const { state } = props
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/50 bg-muted/35 px-3 py-2">
      <Select value={state.project ?? ''} onValueChange={state.setProject}>
        <SelectTrigger
          size="sm"
          aria-label={translate('auto.components.taskPage.azureBoards.project', 'Project')}
        >
          <SelectValue
            placeholder={translate('auto.components.taskPage.azureBoards.project', 'Project')}
          />
        </SelectTrigger>
        <SelectContent>
          {(state.scope?.projects ?? []).map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="h-8 min-w-[10rem] flex-1"
        value={state.filter.search ?? ''}
        placeholder={translate(
          'auto.components.taskPage.azureBoards.searchPlaceholder',
          'Search title or ID'
        )}
        aria-label={translate(
          'auto.components.taskPage.azureBoards.searchPlaceholder',
          'Search title or ID'
        )}
        onChange={(event) => state.setFilter({ ...state.filter, search: event.target.value })}
      />
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Switch
          checked={state.filter.assignedToMe === true}
          onCheckedChange={(checked) => state.setFilter({ ...state.filter, assignedToMe: checked })}
          aria-label={translate(
            'auto.components.taskPage.azureBoards.assignedToMe',
            'Assigned to me'
          )}
        />
        {translate('auto.components.taskPage.azureBoards.assignedToMe', 'Assigned to me')}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Switch
          checked={state.filter.includeClosed === true}
          onCheckedChange={(checked) =>
            state.setFilter({ ...state.filter, includeClosed: checked })
          }
          aria-label={translate(
            'auto.components.taskPage.azureBoards.includeClosed',
            'Include closed'
          )}
        />
        {translate('auto.components.taskPage.azureBoards.includeClosed', 'Include closed')}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={translate('auto.components.taskPage.azureBoards.refresh', 'Refresh')}
        onClick={() => void state.reload()}
      >
        {state.loading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
      </Button>
      <Button size="sm" disabled={!state.project} onClick={props.onCreate}>
        <Plus />
        {translate('auto.components.taskPage.azureBoards.new', 'New')}
      </Button>
    </div>
  )
}

function WorkItemRow(props: {
  item: AzureBoardsWorkItem
  selected: boolean
  onOpen: () => void
  onStart: () => void
}): React.JSX.Element {
  const { item } = props
  return (
    <li
      className="group/row flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent/40 data-[selected=true]:bg-accent/60"
      data-selected={props.selected}
      onClick={props.onOpen}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-foreground">{item.title}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {[
            `${item.workItemType} ${azureBoardsWorkItemIdentifier(item.id)}`,
            item.state,
            item.assignedTo
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <span className="opacity-0 group-hover/row:opacity-100 focus-within:opacity-100">
        <Button
          variant="ghost"
          size="xs"
          onClick={(event) => {
            event.stopPropagation()
            props.onStart()
          }}
        >
          <Play />
          {translate('auto.components.taskPage.azureBoards.start', 'Start')}
        </Button>
      </span>
    </li>
  )
}

function SetupNotice(props: { error: string | null; onRetry: () => void; onHide: () => void }) {
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-md border border-border/50 bg-muted/50 px-6 py-14 text-center shadow-sm">
      <Kanban className="mb-4 size-8 text-muted-foreground/60" />
      <p className="text-base font-medium text-foreground">
        {translate('auto.components.taskPage.azureBoards.setupTitle', 'Set up Azure Boards')}
      </p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {props.error ??
          translate(
            'auto.components.taskPage.azureBoards.setupDescription',
            'Sign in to Azure DevOps and choose a default organization in Settings > Integrations.'
          )}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => openSettingsTarget({ pane: 'integrations', repoId: null })}>
          {translate('auto.components.taskPage.azureBoards.openIntegrations', 'Open Integrations')}
        </Button>
        <Button variant="outline" onClick={props.onRetry}>
          {translate('auto.components.taskPage.azureBoards.retry', 'Retry')}
        </Button>
        <Button variant="ghost" onClick={props.onHide}>
          {translate('auto.components.taskPage.azureBoards.hide', 'Hide Azure Boards')}
        </Button>
      </div>
    </div>
  )
}

export function TaskPageAzureBoardsContent({
  model
}: {
  model: TaskPageComposerActionsModel
}): React.JSX.Element {
  const state = useAzureBoardsTasks()
  const openModal = useAppStore((s) => s.openModal)
  const [creating, setCreating] = useState(false)

  const startWorkspace = (item: AzureBoardsWorkItem): void => {
    const taskSourceContext = normalizeTaskSourceContext({
      provider: 'azure-boards',
      projectId: model.fallbackTaskSourceProjectId,
      hostId: model.accountBackedTaskSourceHostId,
      providerIdentity: {
        provider: 'azure-boards',
        organizationUrl: state.scope?.organizationUrl ?? null,
        project: state.project
      },
      accountLabel: state.project
    })
    openModal('new-workspace-composer', {
      linkedWorkItem: {
        type: 'issue',
        provider: 'azure-boards',
        number: item.id,
        title: item.title,
        url: item.url
      },
      taskSourceContext,
      telemetrySource: 'sidebar'
    })
  }

  if (state.scopeError || (state.scope && !state.scope.organizationUrl)) {
    return (
      <SetupNotice
        error={state.scopeError}
        onRetry={() => void state.retryScope()}
        onHide={() => model.hideTaskSource('azure-boards', 'Azure Boards')}
      />
    )
  }
  if (!state.scope) {
    return (
      <div className="mt-4 flex items-center justify-center py-14">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  return (
    <div className="mt-3 flex min-h-0 max-h-full flex-col overflow-hidden rounded-md border border-border/50 bg-background shadow-sm">
      <Toolbar state={state} onCreate={() => setCreating(true)} />
      <div className="flex min-h-0 flex-1">
        <ul className="min-h-0 flex-1 divide-y divide-border/50 overflow-y-auto scrollbar-sleek">
          {state.listError ? (
            <li className="px-4 py-4 text-sm text-destructive">{state.listError}</li>
          ) : null}
          {!state.loading && !state.listError && state.items.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              {translate(
                'auto.components.taskPage.azureBoards.empty',
                'No work items match these filters.'
              )}
            </li>
          ) : null}
          {state.items.map((item) => (
            <WorkItemRow
              key={item.id}
              item={item}
              selected={item.id === state.selectedId}
              onOpen={() => state.select(item.id)}
              onStart={() => startWorkspace(item)}
            />
          ))}
        </ul>
        {state.selectedId !== null ? (
          <div className="flex w-[45%] min-w-[18rem] flex-col border-l border-border/50">
            {state.detail ? (
              <AzureBoardsWorkItemDetailView
                state={state}
                detail={state.detail}
                onStartWorkspace={startWorkspace}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        ) : null}
      </div>
      {creating ? (
        <AzureBoardsCreateWorkItemDialog state={state} onOpenChange={setCreating} />
      ) : null}
    </div>
  )
}
