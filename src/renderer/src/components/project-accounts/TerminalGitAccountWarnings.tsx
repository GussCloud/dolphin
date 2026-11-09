import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import type { getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import { listTerminalGitAccountWarnings } from './project-account-client'

type TerminalGitAccountWarningsProps = {
  repoId: string
  runtimeTarget: ReturnType<typeof getActiveRuntimeTarget>
  /** Changes whenever the project's binding changes, so the warnings are re-read. */
  bindingKey: string
}

/** Persistent inline status: where the chosen account does not reach this project's terminals. */
export function TerminalGitAccountWarnings({
  repoId,
  runtimeTarget,
  bindingKey
}: TerminalGitAccountWarningsProps): React.JSX.Element | null {
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    void listTerminalGitAccountWarnings(runtimeTarget, repoId)
      .catch(() => [])
      .then((next) => {
        if (!cancelled) {
          setWarnings(next)
        }
      })
    return () => {
      cancelled = true
    }
  }, [repoId, runtimeTarget, bindingKey])

  if (warnings.length === 0) {
    return null
  }
  return (
    <ul className="space-y-1" role="status">
      {warnings.map((warning) => (
        <li key={warning} className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{warning}</span>
        </li>
      ))}
    </ul>
  )
}
