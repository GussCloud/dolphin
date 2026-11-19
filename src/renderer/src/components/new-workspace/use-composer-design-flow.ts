import { useCallback, useState } from 'react'
import {
  createDesignDraft,
  designDraftBlocksCreate,
  designDraftForName,
  type DesignDraft
} from '@/lib/design-draft'
import { submitDesignFromComposer, type SubmitDesignInput } from '@/lib/design-composer-submit'
import type { QuickSubmitOptions } from '@/hooks/composer-state/composer-submit-model'
import type { TuiAgent } from '../../../../shared/tui-agent'

export type ComposerDesignFlow = {
  designDraft: DesignDraft
  setDesignDraft: (next: DesignDraft) => void
  /** True while the design cannot be submitted (also during an in-flight `design.create`). */
  designBlocksCreate: boolean
  submitDesign: (options: QuickSubmitOptions | undefined) => Promise<void>
}

/** The composer modal's Design flow state; inert unless the modal opened in design mode. */
export function useComposerDesignFlow(input: {
  repoId: string
  name: string
  agent: TuiAgent | null
  /** Folder and multi-project targets drop the argv prompt and have no single worktree pane. */
  targetUnavailable: boolean
  submitQuick: SubmitDesignInput['submitQuick']
  initialRequest?: string
}): ComposerDesignFlow {
  const { repoId, name, agent, submitQuick } = input
  const [storedDraft, setDesignDraft] = useState<DesignDraft>(() => ({
    ...createDesignDraft(),
    request: input.initialRequest ?? ''
  }))
  const designDraft = designDraftForName(storedDraft, name)
  const [submitting, setSubmitting] = useState(false)
  const designBlocksCreate =
    input.targetUnavailable || submitting || designDraftBlocksCreate(designDraft, { name, agent })
  const request = designDraft.request
  const submitDesign = useCallback(
    async (options: QuickSubmitOptions | undefined): Promise<void> => {
      if (agent === null) {
        return
      }
      setSubmitting(true)
      try {
        await submitDesignFromComposer({ repoId, name, request, agent, submitQuick, options })
      } finally {
        setSubmitting(false)
      }
    },
    [agent, name, repoId, request, submitQuick]
  )
  return { designDraft, setDesignDraft, designBlocksCreate, submitDesign }
}
