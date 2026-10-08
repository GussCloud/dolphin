import { useState } from 'react'
import { ExternalLink, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { TELEGRAM_SETTINGS_TARGET_ID } from '@/lib/settings-navigation-types'
import type { TelegramBridgeState } from '../../../../shared/telegram-bridge-state'
import { IntegrationCardDetails, IntegrationCardShell } from './integration-card-shell'
import { telegramStatusHint, telegramStatusLabel, telegramStatusTone } from './telegram-card-state'
import { useTelegramBridgeState } from './use-telegram-bridge-state'

const BOTFATHER_URL = 'https://t.me/BotFather'
// Literal Telegram syntax, not prose: the token shape and the bot command.
const BOT_TOKEN_PLACEHOLDER = '123456789:AA…'
const PAIR_COMMAND = '/pair'

type MutationRunner = ReturnType<typeof useTelegramBridgeState>['run']

function TokenSection(props: {
  state: TelegramBridgeState
  busy: boolean
  run: MutationRunner
}): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [replacing, setReplacing] = useState(false)
  const editing = !props.state.tokenConfigured || replacing

  const save = async (): Promise<void> => {
    if (await props.run(() => window.api.telegram.saveToken(draft))) {
      setDraft('')
      setReplacing(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label htmlFor="telegram-bot-token">
          {translate('auto.components.settings.telegramIntegrationCard.tokenLabel', 'Bot token')}
        </Label>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.telegramIntegrationCard.tokenDescription',
            'Create a bot with @BotFather and paste its token. The token is encrypted on this computer and never shown again.'
          )}
        </p>
      </div>
      {editing ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <Input
            id="telegram-bot-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="min-w-[12rem] flex-1"
            placeholder={BOT_TOKEN_PLACEHOLDER}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" size="sm" disabled={props.busy || !draft.trim()}>
            {translate('auto.components.settings.telegramIntegrationCard.saveToken', 'Save')}
          </Button>
          {replacing ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setReplacing(false)}>
              {translate('auto.components.settings.telegramIntegrationCard.cancel', 'Cancel')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.api.shell.openUrl(BOTFATHER_URL)}
          >
            <ExternalLink className="size-3.5" />
            {translate(
              'auto.components.settings.telegramIntegrationCard.openBotFather',
              'Open @BotFather'
            )}
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            {props.state.connection.botUsername
              ? translate(
                  'auto.components.settings.telegramIntegrationCard.tokenSavedFor',
                  'Token saved for @{{value0}}.',
                  { value0: props.state.connection.botUsername }
                )
              : translate(
                  'auto.components.settings.telegramIntegrationCard.tokenSaved',
                  'Token saved.'
                )}
          </p>
          <Button variant="outline" size="sm" onClick={() => setReplacing(true)}>
            {translate('auto.components.settings.telegramIntegrationCard.replaceToken', 'Replace')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={props.busy}
            onClick={() => void props.run(() => window.api.telegram.clearToken())}
          >
            {translate('auto.components.settings.telegramIntegrationCard.removeToken', 'Remove')}
          </Button>
        </div>
      )}
      {props.state.protectionGap ? (
        <p className="text-[11px] text-muted-foreground">{props.state.protectionGap}</p>
      ) : null}
    </div>
  )
}

function ChatsSection(props: {
  state: TelegramBridgeState
  busy: boolean
  run: MutationRunner
}): React.JSX.Element {
  const { state } = props
  const removeLabel = translate(
    'auto.components.settings.telegramIntegrationCard.removeChat',
    'Remove chat'
  )
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label>
          {translate('auto.components.settings.telegramIntegrationCard.chatsLabel', 'Paired chats')}
        </Label>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.telegramIntegrationCard.chatsDescription',
            'Only paired chats receive notices. Messages from any other chat are ignored.'
          )}
        </p>
      </div>
      {state.allowedChats.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.telegramIntegrationCard.noChats',
            'No chats paired yet.'
          )}
        </p>
      ) : (
        <ul className="space-y-1">
          {state.allowedChats.map((chat) => (
            <li
              key={chat.chatId}
              className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/50 px-3 py-1.5 text-xs"
            >
              <span className="min-w-0 flex-1 truncate">{chat.label || chat.chatId}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{chat.chatId}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={removeLabel}
                    disabled={props.busy}
                    onClick={() =>
                      void props.run(() => window.api.telegram.removeChat(chat.chatId))
                    }
                  >
                    <X />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  {removeLabel}
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
      {state.pairingCode ? (
        <div className="space-y-1 rounded-md border border-border/50 bg-muted/50 px-3 py-2">
          <p className="font-mono text-sm">{`${PAIR_COMMAND} ${state.pairingCode.code}`}</p>
          <p className="text-[11px] text-muted-foreground">
            {state.connection.botUsername
              ? translate(
                  'auto.components.settings.telegramIntegrationCard.pairingInstructionsBot',
                  'Send this message to @{{value0}} within 10 minutes. The code works once.',
                  { value0: state.connection.botUsername }
                )
              : translate(
                  'auto.components.settings.telegramIntegrationCard.pairingInstructions',
                  'Send this message to your bot within 10 minutes. The code works once.'
                )}
          </p>
        </div>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        disabled={props.busy || !state.tokenConfigured}
        onClick={() => void props.run(() => window.api.telegram.issuePairingCode())}
      >
        {translate('auto.components.settings.telegramIntegrationCard.pairChat', 'Pair a chat')}
      </Button>
    </div>
  )
}

function ChannelsSection(props: {
  state: TelegramBridgeState
  busy: boolean
  run: MutationRunner
}): React.JSX.Element {
  const label = translate(
    'auto.components.settings.telegramIntegrationCard.channelsLabel',
    'Answer Claude Code through a channel (experimental)'
  )
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor="telegram-claude-channels">{label}</Label>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.telegramIntegrationCard.channelsDescription',
            'Delivers Telegram replies straight into Claude Code sessions. While on, Claude asks you to confirm loading a local development channel every time it starts, and channels only work when Claude is signed in with claude.ai or a Console API key (not Bedrock, Vertex AI or Foundry).'
          )}
        </p>
      </div>
      <Switch
        id="telegram-claude-channels"
        aria-label={label}
        checked={props.state.channelsEnabled}
        disabled={props.busy}
        onCheckedChange={(checked) =>
          void props.run(() => window.api.telegram.setChannelsEnabled(checked))
        }
      />
    </div>
  )
}

export function TelegramIntegrationCard(): React.JSX.Element {
  const { state, busy, run } = useTelegramBridgeState()
  const hint = telegramStatusHint(state)
  const enableLabel = translate(
    'auto.components.settings.telegramIntegrationCard.enable',
    'Send agent notices to Telegram'
  )

  return (
    <IntegrationCardShell
      icon={<Send className="size-5" />}
      name={translate('auto.components.settings.telegramIntegrationCard.name', 'Telegram')}
      description={translate(
        'auto.components.settings.telegramIntegrationCard.summary',
        'Get a message when an agent finishes, is blocked, or waits for you, from every workspace.'
      )}
      statusLabel={telegramStatusLabel(state)}
      statusTone={telegramStatusTone(state)}
      checking={state == null}
      settingsSectionId={TELEGRAM_SETTINGS_TARGET_ID}
      actions={
        state?.available ? (
          <Switch
            aria-label={enableLabel}
            checked={state.enabled}
            disabled={busy || (!state.tokenConfigured && !state.enabled)}
            onCheckedChange={(checked) => void run(() => window.api.telegram.setEnabled(checked))}
          />
        ) : null
      }
    >
      {state == null ? null : (
        <IntegrationCardDetails>
          {state.available ? (
            <>
              {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
              <TokenSection state={state} busy={busy} run={run} />
              <ChatsSection state={state} busy={busy} run={run} />
              <ChannelsSection state={state} busy={busy} run={run} />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {translate(
                'auto.components.settings.telegramIntegrationCard.unavailable',
                'Telegram notices run in the Dolphin desktop app and are not available on this host.'
              )}
            </p>
          )}
        </IntegrationCardDetails>
      )}
    </IntegrationCardShell>
  )
}
