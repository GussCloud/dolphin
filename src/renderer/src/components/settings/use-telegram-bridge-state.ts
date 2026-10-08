import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { TelegramBridgeState } from '../../../../shared/telegram-bridge-state'

export function useTelegramBridgeState(): {
  state: TelegramBridgeState | null
  busy: boolean
  run: (mutation: () => Promise<TelegramBridgeState>) => Promise<boolean>
} {
  const [state, setState] = useState<TelegramBridgeState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let disposed = false
    void window.api.telegram
      .getState()
      .then((next) => {
        if (!disposed) {
          setState(next)
        }
      })
      .catch((error: unknown) => console.error('[telegram] failed to load bridge state', error))
    const unsubscribe = window.api.telegram.onChanged((next) => setState(next))
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [])

  const run = useCallback(async (mutation: () => Promise<TelegramBridgeState>) => {
    setBusy(true)
    try {
      setState(await mutation())
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  return { state, busy, run }
}
