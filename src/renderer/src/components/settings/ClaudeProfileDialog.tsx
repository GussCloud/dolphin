import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type {
  ClaudeProfileDetails,
  ClaudeProfileImportItem
} from '../../../../shared/claude-profile-types'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'

const T = 'auto.components.settings.ClaudeProfileDialog'

function kindLabel(item: ClaudeProfileImportItem): string {
  switch (item.kind) {
    case 'instructions':
      return translate(`${T}.kind.instructions`, 'Instructions')
    case 'settings':
      return translate(`${T}.kind.settings`, 'Settings')
    case 'keybindings':
      return translate(`${T}.kind.keybindings`, 'Keybindings')
    case 'skill':
      return translate(`${T}.kind.skill`, 'Skill')
    case 'agent':
      return translate(`${T}.kind.agent`, 'Agent')
    case 'command':
      return translate(`${T}.kind.command`, 'Command')
    case 'output-style':
      return translate(`${T}.kind.outputStyle`, 'Output style')
    case 'mcp-server':
      return translate(`${T}.kind.mcp`, 'MCP server')
    case 'plugin':
      return translate(`${T}.kind.plugin`, 'Plugin')
  }
}

/** One account's profile: its folder, instructions, MCP servers and what to bring from ~/.claude. */
export default function ClaudeProfileDialog(props: {
  accountId: string
  email: string
  onClose: () => void
}): React.JSX.Element {
  const { accountId, email, onClose } = props
  const [details, setDetails] = useState<ClaudeProfileDetails | null>(null)
  const [instructions, setInstructions] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const next = await window.api.claudeAccounts.profile({ accountId })
      setDetails(next)
      setInstructions(next.instructions ?? '')
      setSelected(new Set())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [accountId])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true)
    try {
      await action()
      await load()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id: string, checked: boolean): void => {
    const next = new Set(selected)
    if (checked) {
      next.add(id)
    } else {
      next.delete(id)
    }
    setSelected(next)
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {translate(`${T}.title`, 'Profile of {{value0}}', { value0: email })}
          </DialogTitle>
          <DialogDescription>
            {translate(
              `${T}.description`,
              'This account keeps its own instructions, MCP servers, skills and history. Nothing here reaches your other accounts.'
            )}
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {!details ? (
          error ? null : (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )
        ) : (
          <div className="scrollbar-sleek max-h-[65vh] space-y-5 overflow-y-auto pr-1">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {details.configDir}
              </span>
              <Button
                variant="outline"
                size="xs"
                onClick={() => void window.api.shell.openPath(details.configDir)}
              >
                <FolderOpen className="size-3" />
                {translate(`${T}.openFolder`, 'Open folder')}
              </Button>
            </div>

            {details.reviewPending ? (
              <div className="space-y-2 rounded-md border border-border px-3 py-2.5">
                <p className="text-sm font-medium">
                  {translate(`${T}.review.title`, 'Review this account')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {translate(
                    `${T}.review.body`,
                    'Dolphin converted this account from the old shared layout and copied from your ~/.claude: {{value0}}. These copies now belong to this account only, and its MCP servers were removed. Check that they fit this account.',
                    { value0: details.migratedCopied.join(', ') || '—' }
                  )}
                </p>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(() => window.api.claudeAccounts.markProfileReviewed({ accountId }))
                  }
                >
                  {translate(`${T}.review.done`, 'Reviewed')}
                </Button>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="claude-profile-instructions">
                {translate(`${T}.instructions`, 'Instructions (CLAUDE.md)')}
              </Label>
              <Textarea
                id="claude-profile-instructions"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                rows={8}
              />
              <Button
                size="xs"
                disabled={busy || instructions === (details.instructions ?? '')}
                onClick={() =>
                  void run(async () => {
                    await window.api.claudeAccounts.saveProfileInstructions({
                      accountId,
                      content: instructions
                    })
                    toast.success(translate(`${T}.saved`, 'Instructions saved.'))
                  })
                }
              >
                {translate(`${T}.save`, 'Save instructions')}
              </Button>
            </div>

            <div className="space-y-1">
              <Label>{translate(`${T}.mcp`, 'MCP servers of this account')}</Label>
              {details.mcpServers.length > 0 ? (
                details.mcpServers.map((name) => (
                  <div key={name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-mono">{name}</span>
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={busy}
                      aria-label={translate(`${T}.removeMcp`, 'Remove {{value0}}', {
                        value0: name
                      })}
                      onClick={() =>
                        void run(() =>
                          window.api.claudeAccounts.removeProfileMcpServer({ accountId, name })
                        )
                      }
                    >
                      <Trash2 className="size-3" />
                      {translate(`${T}.remove`, 'Remove')}
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  {translate(`${T}.mcpNone`, 'None.')}
                </p>
              )}
            </div>

            {details.linked ? (
              <p className="text-xs text-muted-foreground">
                {translate(
                  `${T}.linkedNote`,
                  'This is a folder you manage yourself, so Dolphin does not import anything into it.'
                )}
              </p>
            ) : (
              <div className="space-y-2">
                <Label>{translate(`${T}.import`, 'Bring from your ~/.claude')}</Label>
                <p className="text-xs text-muted-foreground">
                  {translate(
                    `${T}.importNote`,
                    'Nothing is selected for you. MCP servers and plugins carry accesses: pick only the ones this account should have.'
                  )}
                </p>
                {details.importItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {translate(`${T}.importNone`, 'Nothing to bring.')}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {details.importItems.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={selected.has(item.id)}
                          disabled={busy || item.existsInProfile}
                          onCheckedChange={(checked) => toggle(item.id, checked === true)}
                          aria-label={`${kindLabel(item)} ${item.name}`}
                        />
                        <span className="text-muted-foreground">{kindLabel(item)}</span>
                        <span className="truncate font-mono">{item.name}</span>
                        {item.existsInProfile ? (
                          <span className="text-muted-foreground">
                            {translate(`${T}.exists`, '(already here)')}
                          </span>
                        ) : item.sensitive ? (
                          <span className="text-muted-foreground">
                            {translate(`${T}.sensitive`, '(gives access)')}
                          </span>
                        ) : null}
                      </label>
                    ))}
                  </div>
                )}
                <Button
                  size="xs"
                  disabled={busy || selected.size === 0}
                  onClick={() =>
                    void run(async () => {
                      const result = await window.api.claudeAccounts.importIntoProfile({
                        accountId,
                        ids: [...selected]
                      })
                      toast.success(
                        translate(`${T}.imported`, 'Imported {{value0}} item(s).', {
                          value0: result.imported.length
                        })
                      )
                    })
                  }
                >
                  {translate(`${T}.importAction`, 'Import selected')}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
