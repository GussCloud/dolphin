import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, Link2, Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { ClaudeConfigFolderDiscovery } from '../../../../shared/managed-account-types'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import type { ClaudeAccountAction, ClaudeAccountActionRunner } from './accounts-pane-types'

const T = 'auto.components.settings.ClaudeLinkedFolders'

/**
 * Folders the user's terminal account menu already manages. Linking one makes Dolphin launch in
 * it as is; "Choose folder" covers menus the detection does not recognize.
 */
export function ClaudeLinkedFolders(props: {
  claudeAction: ClaudeAccountAction
  runClaudeAccountAction: ClaudeAccountActionRunner
  linkedAccountCount: number
}): React.JSX.Element {
  const { claudeAction, runClaudeAccountAction, linkedAccountCount } = props
  const [discovery, setDiscovery] = useState<ClaudeConfigFolderDiscovery | null>(null)

  const refresh = useCallback(() => {
    void window.api.claudeAccounts
      .discoverFolders()
      .then(setDiscovery)
      .catch(() => setDiscovery({ selectorFile: null, folders: [] }))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, linkedAccountCount])

  const link = (configDir: string): void => {
    void runClaudeAccountAction(`link:${configDir}`, () =>
      window.api.claudeAccounts.linkFolder({ configDir })
    ).then(refresh)
  }

  const chooseFolder = async (): Promise<void> => {
    const configDir = await window.api.claudeAccounts.pickFolder()
    if (configDir) {
      link(configDir)
    }
  }

  const busy = claudeAction !== 'idle'
  const folders = discovery?.folders ?? []

  return (
    <div className="space-y-2 rounded-md border border-border/70 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">
            {translate(`${T}.title`, 'Account folders you already use')}
          </p>
          <p className="text-xs text-muted-foreground">
            {discovery?.selectorFile
              ? translate(
                  `${T}.found`,
                  'Your terminal picks a Claude account in {{value0}}. Link its folders so Dolphin uses the same login, instructions and MCP servers, without asking.',
                  { value0: discovery.selectorFile }
                )
              : translate(
                  `${T}.notFound`,
                  'If you keep Claude accounts in your own folders (CLAUDE_CONFIG_DIR), choose one to link it. Dolphin uses it as is and never changes its login.'
                )}
          </p>
        </div>
        <Button
          variant="outline"
          size="xs"
          onClick={() => void chooseFolder()}
          disabled={busy}
          className="shrink-0"
        >
          <FolderOpen className="size-3" />
          {translate(`${T}.choose`, 'Choose folder')}
        </Button>
      </div>
      {folders.map((folder) => {
        const linking = claudeAction === `link:${folder.configDir}`
        return (
          <div
            key={folder.configDir}
            className="flex items-center justify-between gap-3 border-t border-border/50 pt-2"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm">
                  {folder.email ?? translate(`${T}.noLogin`, 'No login yet')}
                </span>
                {folder.isDefault ? (
                  <Badge
                    variant="outline"
                    className="h-4 shrink-0 rounded px-1.5 text-[10px] font-medium leading-none text-foreground/70"
                  >
                    {translate(`${T}.default`, 'Default folder')}
                  </Badge>
                ) : null}
              </div>
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {folder.configDir}
              </span>
            </div>
            {folder.linkedAccountId ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {translate(`${T}.linked`, 'Linked')}
              </span>
            ) : (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => link(folder.configDir)}
                disabled={busy || !folder.email}
                className="shrink-0"
              >
                {linking ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Link2 className="size-3" />
                )}
                {translate(`${T}.link`, 'Link')}
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
