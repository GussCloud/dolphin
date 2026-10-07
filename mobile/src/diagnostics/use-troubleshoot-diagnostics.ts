import { useCallback, useRef, useState } from 'react'
import type { View } from 'react-native'
import { Platform } from 'react-native'
import { loadHosts } from '../transport/host-store'
import {
  startDiagnosticFetchTimeout,
  type DiagnosticFetchTimeout
} from './diagnostic-fetch-timeout'
import { formatEndpoint, testHostReachability, unreachableHostDetail } from './host-reachability'
import type { CheckResult, DiagnosticStatus } from './troubleshoot-view'
import { diagnosticsCatalog } from '../i18n/catalogs/diagnostics'
import { translate } from '../i18n/mobile-locale-state'

export function useTroubleshootDiagnostics() {
  const [diagnosticStatus, setDiagnosticStatus] = useState<DiagnosticStatus>('idle')
  const [checks, setChecks] = useState<CheckResult[]>([])
  const abortRef = useRef(false)
  const diagnosticRunRef = useRef(0)
  const activeInternetCheckRef = useRef<DiagnosticFetchTimeout | null>(null)

  const rootRef = useCallback((node: View | null): void => {
    if (node !== null) {
      return
    }
    // Why: diagnostics can outlive the screen; cancel the active run when the
    // route detaches without a passive cleanup-only Effect.
    abortRef.current = true
    diagnosticRunRef.current += 1
    activeInternetCheckRef.current?.dispose()
    activeInternetCheckRef.current = null
  }, [])

  const runDiagnostics = useCallback(async () => {
    const runId = diagnosticRunRef.current + 1
    diagnosticRunRef.current = runId
    abortRef.current = false
    activeInternetCheckRef.current?.dispose()
    activeInternetCheckRef.current = null
    setDiagnosticStatus('running')
    setChecks([])

    const results: CheckResult[] = []
    const isCurrentRun = () => !abortRef.current && diagnosticRunRef.current === runId

    try {
      const hosts = await loadHosts()
      results.push(
        hosts.length > 0
          ? {
              label: translate(diagnosticsCatalog, 'checkPairedHosts'),
              status: 'pass',
              detail: translate(diagnosticsCatalog, 'checkPairedCount', { count: hosts.length })
            }
          : {
              label: translate(diagnosticsCatalog, 'checkPairedHosts'),
              status: 'fail',
              detail: translate(diagnosticsCatalog, 'checkPairedNone')
            }
      )
    } catch {
      results.push({
        label: translate(diagnosticsCatalog, 'checkPairedHosts'),
        status: 'warn',
        detail: translate(diagnosticsCatalog, 'checkPairedReadError')
      })
    }

    if (!isCurrentRun()) {
      return
    }
    setChecks([...results])

    const internetCheck = startDiagnosticFetchTimeout(5000)
    activeInternetCheckRef.current = internetCheck
    try {
      const resp = await fetch('https://dns.google/resolve?name=example.com&type=A', {
        signal: internetCheck.signal
      })
      if (!isCurrentRun()) {
        return
      }
      results.push(
        resp.ok
          ? {
              label: translate(diagnosticsCatalog, 'checkInternet'),
              status: 'pass',
              detail: translate(diagnosticsCatalog, 'checkInternetConnected')
            }
          : {
              label: translate(diagnosticsCatalog, 'checkInternet'),
              status: 'warn',
              detail: translate(diagnosticsCatalog, 'checkInternetUnexpected')
            }
      )
    } catch {
      if (!isCurrentRun()) {
        return
      }
      results.push({
        label: translate(diagnosticsCatalog, 'checkInternet'),
        status: 'fail',
        detail: translate(diagnosticsCatalog, 'checkInternetNone')
      })
    } finally {
      internetCheck.dispose()
      if (activeInternetCheckRef.current === internetCheck) {
        activeInternetCheckRef.current = null
      }
    }

    if (!isCurrentRun()) {
      return
    }
    setChecks([...results])

    try {
      const hosts = await loadHosts()
      for (const host of hosts) {
        if (!isCurrentRun()) {
          return
        }
        const reachable = await testHostReachability(host.endpoint)
        if (!isCurrentRun()) {
          return
        }
        results.push({
          label: host.name,
          status: reachable ? 'pass' : 'fail',
          detail: reachable
            ? translate(diagnosticsCatalog, 'checkReachableAt', {
                endpoint: formatEndpoint(host.endpoint)
              })
            : unreachableHostDetail(host.endpoint)
        })
        setChecks([...results])
      }
    } catch {
      results.push({
        label: translate(diagnosticsCatalog, 'checkHosts'),
        status: 'warn',
        detail: translate(diagnosticsCatalog, 'checkHostsError')
      })
    }

    if (!isCurrentRun()) {
      return
    }

    results.push({
      label: translate(diagnosticsCatalog, 'checkPlatform'),
      status: 'pass',
      detail: `${Platform.OS} ${Platform.Version ?? ''}`
    })

    setChecks([...results])
    setDiagnosticStatus('done')
  }, [])

  return { rootRef, diagnosticStatus, checks, runDiagnostics }
}
