import { useId } from 'react'
import { Loader2, Lock, LockOpen, RotateCw } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import {
  DEEPSEEK_CLAUDE_CONFIG_DIR_NAME,
  DEEPSEEK_MODEL_SLOT_ENV,
  DEEPSEEK_MODEL_SLOT_KEYS,
  type DeepSeekModelSlots
} from '../../../../shared/deepseek-claude-provider'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { SettingsBadge } from './SettingsFormControls'
import { DeepSeekModelSlotPicker } from './DeepSeekModelSlotPicker'
import { buildDeepSeekModelPickerOptions } from './deepseek-model-picker-options'
import {
  useDeepSeekCredentials,
  type DeepSeekCredentialsController,
  type DeepSeekModelsState
} from './use-deepseek-credentials'

function getSlotLabel(slot: keyof DeepSeekModelSlots): string {
  switch (slot) {
    case 'main':
      return translate('settings.agents.deepseek.slot.main', 'Main')
    case 'opus':
      return translate('settings.agents.deepseek.slot.opus', 'Opus')
    case 'sonnet':
      return translate('settings.agents.deepseek.slot.sonnet', 'Sonnet')
    case 'haiku':
      return translate('settings.agents.deepseek.slot.haiku', 'Haiku')
    case 'subagent':
      return translate('settings.agents.deepseek.slot.subagent', 'Subagent')
  }
}

function getModelsErrorMessage(
  reason: Extract<DeepSeekModelsState, { kind: 'error' }>['reason']
): string {
  switch (reason) {
    case 'no-api-key':
      return translate(
        'settings.agents.deepseek.error.noApiKey',
        'The saved DeepSeek API key could not be read. Save it again.'
      )
    case 'unauthorized':
      return translate(
        'settings.agents.deepseek.error.unauthorized',
        'DeepSeek rejected the saved API key. Replace it and try again.'
      )
    case 'network':
      return translate(
        'settings.agents.deepseek.error.network',
        "Couldn't reach DeepSeek. Check your connection and try again."
      )
    case 'invalid-response':
      return translate(
        'settings.agents.deepseek.error.invalidResponse',
        'DeepSeek returned a model list Dolphin could not read.'
      )
    case 'failed':
      return translate('settings.agents.deepseek.error.failed', "Couldn't load DeepSeek models.")
  }
}

function DeepSeekApiKeyField({
  credentials
}: {
  credentials: DeepSeekCredentialsController
}): React.JSX.Element {
  const inputId = useId()
  const {
    apiKeyConfigured,
    encryptionAvailable,
    busy,
    draft,
    setDraft,
    keyError,
    saveApiKey,
    clearApiKey
  } = credentials
  const errorId = useId()
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="text-xs text-muted-foreground">
          {translate('settings.agents.deepseek.apiKey', 'DeepSeek API key')}
        </label>
        {apiKeyConfigured === null ? null : (
          <SettingsBadge tone={apiKeyConfigured ? 'neutral' : 'muted'}>
            {apiKeyConfigured ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
            {apiKeyConfigured
              ? translate('settings.agents.deepseek.configured', 'Configured')
              : translate('settings.agents.deepseek.notConfigured', 'Not configured')}
          </SettingsBadge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          type="password"
          autoComplete="off"
          disabled={busy || !encryptionAvailable}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void saveApiKey()
            }
          }}
          placeholder={
            apiKeyConfigured
              ? translate(
                  'settings.agents.deepseek.apiKeyReplacePlaceholder',
                  'Paste a new key to replace the saved one'
                )
              : translate(
                  'settings.agents.deepseek.apiKeyPlaceholder',
                  'Paste your DeepSeek API key'
                )
          }
          spellCheck={false}
          aria-invalid={keyError !== null}
          aria-describedby={keyError === null ? undefined : errorId}
          className="h-7 flex-1"
        />
        <Button
          type="button"
          size="xs"
          onClick={() => void saveApiKey()}
          disabled={busy || !encryptionAvailable || !draft.trim()}
          className="h-7 shrink-0"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : null}
          {apiKeyConfigured
            ? translate('settings.agents.deepseek.replace', 'Replace')
            : translate('settings.agents.deepseek.save', 'Save')}
        </Button>
        {apiKeyConfigured ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => void clearApiKey()}
            disabled={busy}
            className="h-7 shrink-0"
          >
            {translate('settings.agents.deepseek.clear', 'Clear')}
          </Button>
        ) : null}
      </div>
      {encryptionAvailable ? null : (
        <p className="text-xs text-destructive">
          {translate(
            'settings.agents.deepseek.encryptionUnavailable',
            "Secure storage is unavailable on this system, so Dolphin can't save a DeepSeek key here."
          )}
        </p>
      )}
      {keyError === null ? null : (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {keyError}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        {translate(
          'settings.agents.deepseek.apiKeyHelp',
          'Stored encrypted on this device and sent only to DeepSeek. Create a key at platform.deepseek.com.'
        )}
      </p>
    </div>
  )
}

function DeepSeekModelSlotsSection({
  models,
  slots,
  onReload,
  onSaveSlots
}: {
  models: DeepSeekModelsState
  slots: DeepSeekModelSlots
  onReload: () => void
  onSaveSlots: (slots: DeepSeekModelSlots) => void
}): React.JSX.Element | null {
  if (models.kind === 'idle') {
    return null
  }
  if (models.kind === 'loading') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        {translate('settings.agents.deepseek.loadingModels', 'Loading DeepSeek models…')}
      </p>
    )
  }
  if (models.kind === 'error') {
    return (
      <div className="flex items-center gap-2">
        <p role="alert" className="text-xs text-destructive">
          {getModelsErrorMessage(models.reason)}
        </p>
        <Button type="button" variant="ghost" size="xs" onClick={onReload} className="h-7 shrink-0">
          <RotateCw className="size-3" />
          {translate('settings.agents.deepseek.retry', 'Retry')}
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">
        {translate('settings.agents.deepseek.models', 'Models')}
      </span>
      {DEEPSEEK_MODEL_SLOT_KEYS.map((slot) => (
        <DeepSeekModelSlotPicker
          key={slot}
          label={getSlotLabel(slot)}
          envName={DEEPSEEK_MODEL_SLOT_ENV[slot]}
          value={slots[slot]}
          options={buildDeepSeekModelPickerOptions(models.models, slots[slot])}
          onChange={(value) => onSaveSlots({ ...slots, [slot]: value })}
        />
      ))}
      <p className="text-[11px] text-muted-foreground">
        {translate(
          'settings.agents.deepseek.modelsHelp',
          'Claude Code sends each role to the model picked here. Changes apply to DeepSeek sessions started afterwards.'
        )}
      </p>
    </div>
  )
}

/** API key and per-slot model pickers shared by the DeepSeek and DeepSeek Agent Teams rows. */
export function DeepSeekProviderSettings({
  slots,
  onSaveSlots
}: {
  slots: DeepSeekModelSlots
  onSaveSlots: (slots: DeepSeekModelSlots) => void
}): React.JSX.Element {
  const credentials = useDeepSeekCredentials()
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-muted-foreground">
        {translate(
          'settings.agents.deepseek.isolationNote',
          'DeepSeek runs Claude Code with its own config folder ({{value0}}). Your Claude settings, skills, and CLAUDE.md are not shared.',
          { value0: `~/${DEEPSEEK_CLAUDE_CONFIG_DIR_NAME}` }
        )}
      </p>
      <DeepSeekApiKeyField credentials={credentials} />
      <DeepSeekModelSlotsSection
        models={credentials.models}
        slots={slots}
        onReload={credentials.reloadModels}
        onSaveSlots={onSaveSlots}
      />
    </div>
  )
}
