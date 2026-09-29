import { useMemo, useState } from 'react'
import { GitPullRequestArrow, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import { listAzureDevOpsRepositories } from '@/lib/azure-devops-host-client'
import { useAppStore } from '@/store'
import type { AzureDevOpsRepository } from '../../../../shared/azure-devops-auth'

export function filterAzureDevOpsRepositories(
  repositories: readonly AzureDevOpsRepository[],
  query: string
): AzureDevOpsRepository[] {
  const needle = query.trim().toLowerCase()
  return needle
    ? repositories.filter((repo) => `${repo.project}/${repo.name}`.toLowerCase().includes(needle))
    : [...repositories]
}

/** Lets a signed-in Azure DevOps user pick a repository instead of pasting its URL. */
export function AzureReposClonePicker(props: {
  disabled: boolean
  onPick: (url: string) => void
}): React.JSX.Element | null {
  const settings = useAppStore((s) => s.settings)
  const azureDevOpsReady = useAppStore(
    (s) => s.preflightStatus?.azureDevOps?.authenticated === true
  )
  const [repositories, setRepositories] = useState<AzureDevOpsRepository[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const visible = useMemo(
    () => filterAzureDevOpsRepositories(repositories ?? [], query),
    [query, repositories]
  )

  if (!azureDevOpsReady) {
    return null
  }

  const load = (): void => {
    setLoading(true)
    setError(null)
    void listAzureDevOpsRepositories(settings)
      .then((result) => (result.ok ? setRepositories(result.repositories) : setError(result.error)))
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : String(caught))
      )
      .finally(() => setLoading(false))
  }

  if (repositories === null) {
    return (
      <div className="space-y-1">
        <Button variant="outline" size="xs" disabled={props.disabled || loading} onClick={load}>
          {loading ? <LoaderCircle className="animate-spin" /> : <GitPullRequestArrow />}
          {translate('auto.components.sidebar.azureReposClonePicker.browse', 'Browse Azure DevOps')}
        </Button>
        {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="space-y-1.5 rounded-md border border-border/60 p-2">
      <Input
        className="h-7"
        value={query}
        placeholder={translate(
          'auto.components.sidebar.azureReposClonePicker.filter',
          'Filter repositories'
        )}
        aria-label={translate(
          'auto.components.sidebar.azureReposClonePicker.filter',
          'Filter repositories'
        )}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul className="max-h-40 overflow-y-auto scrollbar-sleek">
        {visible.length === 0 ? (
          <li className="px-2 py-1.5 text-[11px] text-muted-foreground">
            {translate(
              'auto.components.sidebar.azureReposClonePicker.empty',
              'No repositories found.'
            )}
          </li>
        ) : null}
        {visible.map((repo) => (
          <li key={`${repo.project}/${repo.name}`}>
            <button
              type="button"
              className="flex w-full cursor-pointer items-baseline gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent/60 disabled:cursor-default"
              disabled={props.disabled}
              onClick={() => props.onPick(repo.remoteUrl)}
            >
              <span className="text-muted-foreground">{repo.project}</span>
              <span className="min-w-0 truncate text-foreground">{repo.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
