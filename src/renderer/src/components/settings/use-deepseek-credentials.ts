import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { extractIpcErrorMessage } from '@/lib/ipc-error'
import type {
  DeepSeekCredentialsStatus,
  DeepSeekListModelsResult,
  DeepSeekModelOption
} from '../../../../shared/deepseek-claude-provider'

export type DeepSeekModelsState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; models: DeepSeekModelOption[] }
  | { kind: 'error'; reason: Extract<DeepSeekListModelsResult, { ok: false }>['reason'] | 'failed' }

export type DeepSeekCredentialsController = {
  /** null until the first status read answers. */
  apiKeyConfigured: boolean | null
  /** False when the OS has no secure storage, so main refuses to save a key. */
  encryptionAvailable: boolean
  busy: boolean
  draft: string
  setDraft: (value: string) => void
  /** Last save/clear failure, shown inline until the next edit or success. */
  keyError: string | null
  models: DeepSeekModelsState
  saveApiKey: () => Promise<void>
  clearApiKey: () => Promise<void>
  reloadModels: () => void
}

function keyUpdateError(error: unknown): string {
  return extractIpcErrorMessage(
    error,
    translate('settings.agents.deepseek.keyUpdateFailed', 'DeepSeek API key update failed.')
  )
}

export function useDeepSeekCredentials(): DeepSeekCredentialsController {
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null)
  const [encryptionAvailable, setEncryptionAvailable] = useState(true)
  const [busy, setBusy] = useState(false)
  const [draft, setDraftState] = useState('')
  const [keyError, setKeyError] = useState<string | null>(null)
  const setDraft = (value: string): void => {
    setDraftState(value)
    setKeyError(null)
  }
  const [models, setModels] = useState<DeepSeekModelsState>({ kind: 'idle' })
  // Why: a slower, older listModels answer must not overwrite a newer one (or a cleared key).
  const requestIdRef = useRef(0)

  const loadModels = useCallback(async (): Promise<void> => {
    const requestId = ++requestIdRef.current
    setModels({ kind: 'loading' })
    let next: DeepSeekModelsState
    try {
      const result = await window.api.deepseekCredentials.listModels()
      next = result.ok
        ? { kind: 'ready', models: result.models }
        : { kind: 'error', reason: result.reason }
    } catch {
      next = { kind: 'error', reason: 'failed' }
    }
    if (requestId === requestIdRef.current) {
      setModels(next)
    }
  }, [])

  const applyStatus = useCallback(
    (status: DeepSeekCredentialsStatus): void => {
      setApiKeyConfigured(status.apiKeyConfigured)
      setEncryptionAvailable(status.encryptionAvailable)
      if (status.apiKeyConfigured) {
        void loadModels()
      } else {
        requestIdRef.current++
        setModels({ kind: 'idle' })
      }
    },
    [loadModels]
  )

  useEffect(() => {
    let cancelled = false
    const requestIds = requestIdRef
    window.api.deepseekCredentials
      .getStatus()
      .then((status) => {
        if (!cancelled) {
          applyStatus(status)
        }
      })
      .catch(() => {
        if (!cancelled) {
          applyStatus({ apiKeyConfigured: false, encryptionAvailable: true })
        }
      })
    return () => {
      cancelled = true
      // Why: drop any in-flight listModels answer after unmount.
      requestIds.current++
    }
  }, [applyStatus])

  const saveApiKey = async (): Promise<void> => {
    const key = draft.trim()
    if (!key) {
      return
    }
    setBusy(true)
    try {
      const status = await window.api.deepseekCredentials.saveApiKey(key)
      if (!status.apiKeyConfigured) {
        throw new Error(
          translate('settings.agents.deepseek.keyNotSaved', 'DeepSeek API key was not saved.')
        )
      }
      setDraftState('')
      setKeyError(null)
      applyStatus(status)
      toast.success(translate('settings.agents.deepseek.keySaved', 'DeepSeek API key saved.'))
    } catch (error) {
      setKeyError(keyUpdateError(error))
    } finally {
      setBusy(false)
    }
  }

  const clearApiKey = async (): Promise<void> => {
    setBusy(true)
    try {
      const status = await window.api.deepseekCredentials.clearApiKey()
      setDraftState('')
      setKeyError(null)
      applyStatus(status)
    } catch (error) {
      setKeyError(keyUpdateError(error))
    } finally {
      setBusy(false)
    }
  }

  return {
    apiKeyConfigured,
    encryptionAvailable,
    busy,
    draft,
    setDraft,
    keyError,
    models,
    saveApiKey,
    clearApiKey,
    reloadModels: () => void loadModels()
  }
}
