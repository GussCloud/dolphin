import { useId, useState } from 'react'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { translate } from '@/i18n/i18n'
import { MAX_TUI_AGENT_SESSION_INSTRUCTIONS_LENGTH } from '../../../../shared/tui-agent-session-instructions'

export function AgentSessionInstructionsInput({
  defaultInstructions,
  instructions,
  onSaveInstructions
}: {
  defaultInstructions: string
  instructions: string
  onSaveInstructions: (value: string) => void
}): React.JSX.Element {
  const id = useId()
  const [draft, setDraft] = useState(instructions)
  // Why blur-only: Enter must insert a newline in a multi-line prompt.
  const commit = (): void => {
    if (draft.trim() !== instructions) {
      onSaveInstructions(draft.trim())
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {translate('auto.components.settings.AgentsPane.a7c3e91f42', 'Team instructions')}
      </label>
      <Textarea
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setDraft(instructions)
            event.currentTarget.blur()
          }
        }}
        maxLength={MAX_TUI_AGENT_SESSION_INSTRUCTIONS_LENGTH}
        placeholder={translate(
          'auto.components.settings.AgentsPane.b2d84e0c19',
          'No instructions — Claude decides on its own when to create a team'
        )}
        className="min-h-20"
      />
      <div className="flex items-start gap-2">
        <p className="flex-1 text-[11px] text-muted-foreground">
          {translate(
            'auto.components.settings.AgentsPane.c5f17a3d68',
            'Sent to Claude as a system instruction at the start of every session, so it applies even when you type the first message in the terminal. Leave empty to turn it off.'
          )}
        </p>
        {instructions !== defaultInstructions && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              onSaveInstructions(defaultInstructions)
              setDraft(defaultInstructions)
            }}
            className="shrink-0"
          >
            {translate('auto.components.settings.AgentsPane.5200dac9da', 'Reset')}
          </Button>
        )}
      </div>
    </div>
  )
}
