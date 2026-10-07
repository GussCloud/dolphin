import { useCallback, useMemo, useRef, useState } from 'react'
import { Alert } from 'react-native'
import * as ExpoCrypto from 'expo-crypto'
import type { CodexResetCreditExpectedScope } from '../../../src/shared/codex-reset-credit-scope'
import type { RpcClient } from '../transport/rpc-client'
import type { AccountsSnapshot } from './account-usage-state'
import {
  getCodexResetCreditOutcomeCopy,
  getCodexResetCreditScope,
  requestCodexResetCredit
} from './codex-reset-credit'
import { useCodexResetCreditCapability } from './codex-reset-credit-capability'
import { componentsCatalog } from '../i18n/catalogs/components'
import type { componentsEn } from '../i18n/catalogs/components/en'
import type { MobileTranslate } from '../i18n/mobile-i18n-catalog'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

function describeScope(
  snapshot: AccountsSnapshot,
  scope: CodexResetCreditExpectedScope,
  t: MobileTranslate<typeof componentsEn>
): string {
  const account = snapshot.codex.accounts.find((candidate) => candidate.id === scope.accountId)
  const identity = account?.email ?? t('resetScopeSelectedAccount')
  if (scope.target.runtime === 'host') {
    return t('resetScopeOnHost', { identity })
  }
  return t('resetScopeOnWsl', { identity, distro: scope.target.wslDistro ?? '' })
}

export function useCodexResetCreditAction({
  client,
  connected,
  hostId,
  snapshot,
  accountMutationBusy,
  onSnapshot
}: {
  client: RpcClient | null
  connected: boolean
  hostId: string | undefined
  snapshot: AccountsSnapshot | null
  accountMutationBusy: boolean
  onSnapshot: (snapshot: AccountsSnapshot) => void
}): {
  supported: boolean
  resetting: boolean
  resetScope: CodexResetCreditExpectedScope | null
  scopeLabel: string | null
  confirmReset: () => void
} {
  const t = useMobileTranslation(componentsCatalog)
  const supported = useCodexResetCreditCapability(client, connected)
  const [resetting, setResetting] = useState(false)
  const inFlightRef = useRef(false)
  const resetScope = useMemo(
    () => (snapshot ? getCodexResetCreditScope(snapshot) : null),
    [snapshot]
  )
  const scopeLabel = useMemo(
    () => (snapshot && resetScope ? describeScope(snapshot, resetScope, t) : null),
    [resetScope, snapshot, t]
  )

  const consume = useCallback(
    async (expectedScope: CodexResetCreditExpectedScope) => {
      if (!client || !hostId || inFlightRef.current) {
        return
      }
      inFlightRef.current = true
      setResetting(true)
      try {
        const result = await requestCodexResetCredit(client, {
          hostId,
          expectedScope,
          createIdempotencyKey: () => ExpoCrypto.randomUUID()
        })
        onSnapshot(result.snapshot)
        if ('status' in result) {
          const message = t('resetDetailsChangedMessage')
          Alert.alert(
            t('resetDetailsChangedTitle'),
            result.attemptJournalRetained
              ? `${message}\n\n${t('resetDiscardedRecordWarning')}`
              : message
          )
          return
        }
        const copy = getCodexResetCreditOutcomeCopy(result.outcome)
        Alert.alert(
          copy.title,
          result.attemptJournalRetained
            ? `${copy.message}\n\n${t('resetConfirmedRecordWarning')}`
            : copy.message
        )
      } catch (error) {
        Alert.alert(t('resetFailedTitle'), error instanceof Error ? error.message : String(error))
      } finally {
        inFlightRef.current = false
        setResetting(false)
      }
    },
    [client, hostId, onSnapshot, t]
  )

  const confirmReset = useCallback(() => {
    if (!supported || !connected || accountMutationBusy || resetting || !resetScope || !snapshot) {
      return
    }
    const confirmedScope = resetScope
    const confirmedLabel = describeScope(snapshot, confirmedScope, t)
    Alert.alert(t('useResetConfirmTitle'), t('useResetConfirmMessage', { scope: confirmedLabel }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('useReset'), onPress: () => void consume(confirmedScope) }
    ])
  }, [accountMutationBusy, connected, consume, resetScope, resetting, snapshot, supported, t])

  return { supported, resetting, resetScope, scopeLabel, confirmReset }
}
