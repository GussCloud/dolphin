import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type {
  AzureBoardsListFilter,
  AzureBoardsResult,
  AzureBoardsScopeInfo,
  AzureBoardsWorkItem,
  AzureBoardsWorkItemDetail
} from '../../../../../shared/azure-boards-types'
import { getAzureBoardsClient } from '@/runtime/runtime-azure-boards-client'
import { useAppStore } from '@/store'

const SEARCH_DEBOUNCE_MS = 300

function unwrap<T>(result: AzureBoardsResult<T>): T {
  if (!result.ok) {
    throw new Error(result.error)
  }
  return result.value
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export type AzureBoardsTasksState = ReturnType<typeof useAzureBoardsTasks>

export function useAzureBoardsTasks() {
  const settings = useAppStore((s) => s.settings)
  const [scope, setScope] = useState<AzureBoardsScopeInfo | null>(null)
  const [scopeError, setScopeError] = useState<string | null>(null)
  const [project, setProject] = useState<string | null>(null)
  const [filter, setFilter] = useState<AzureBoardsListFilter>({ assignedToMe: true })
  const [items, setItems] = useState<AzureBoardsWorkItem[]>([])
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<AzureBoardsWorkItemDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [mutating, setMutating] = useState(false)
  // Why: typing a search fires overlapping lists; only the latest may land.
  const listRequestRef = useRef(0)
  const detailRequestRef = useRef(0)

  const loadScope = useCallback(async () => {
    setScopeError(null)
    try {
      const next = unwrap(await getAzureBoardsClient(settings).scope())
      setScope(next)
      setProject((current) =>
        current && next.projects.includes(current) ? current : next.defaultProject
      )
    } catch (error) {
      setScopeError(message(error))
    }
  }, [settings])

  useEffect(() => {
    void loadScope()
  }, [loadScope])

  const reload = useCallback(async () => {
    if (!project) {
      return
    }
    const requestId = ++listRequestRef.current
    setLoading(true)
    try {
      const next = unwrap(await getAzureBoardsClient(settings).list({ project, ...filter }))
      if (requestId === listRequestRef.current) {
        setItems(next)
        setListError(null)
      }
    } catch (error) {
      if (requestId === listRequestRef.current) {
        setListError(message(error))
      }
    } finally {
      if (requestId === listRequestRef.current) {
        setLoading(false)
      }
    }
  }, [filter, project, settings])

  useEffect(() => {
    const timer = setTimeout(() => void reload(), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [reload])

  const loadDetail = useCallback(
    async (id: number) => {
      if (!project) {
        return
      }
      const requestId = ++detailRequestRef.current
      setDetailLoading(true)
      try {
        const next = unwrap(await getAzureBoardsClient(settings).get({ project, id }))
        if (requestId === detailRequestRef.current) {
          setDetail(next)
        }
      } catch (error) {
        if (requestId === detailRequestRef.current) {
          toast.error(message(error))
        }
      } finally {
        if (requestId === detailRequestRef.current) {
          setDetailLoading(false)
        }
      }
    },
    [project, settings]
  )

  const select = useCallback(
    (id: number | null) => {
      setSelectedId(id)
      setDetail(null)
      if (id !== null) {
        void loadDetail(id)
      }
    },
    [loadDetail]
  )

  const mutate = useCallback(
    async (run: (projectName: string) => Promise<AzureBoardsResult<unknown>>): Promise<boolean> => {
      if (!project) {
        return false
      }
      setMutating(true)
      try {
        unwrap(await run(project))
        await Promise.all([reload(), selectedId !== null ? loadDetail(selectedId) : null])
        return true
      } catch (error) {
        toast.error(message(error))
        return false
      } finally {
        setMutating(false)
      }
    },
    [loadDetail, project, reload, selectedId]
  )

  const listTypes = useCallback(
    async (): Promise<string[]> =>
      project ? unwrap(await getAzureBoardsClient(settings).types({ project })) : [],
    [project, settings]
  )

  const client = getAzureBoardsClient(settings)
  return {
    scope,
    scopeError,
    project,
    setProject: (next: string) => {
      setProject(next)
      select(null)
    },
    filter,
    setFilter,
    items,
    loading,
    listError,
    reload,
    retryScope: loadScope,
    selectedId,
    select,
    detail,
    detailLoading,
    mutating,
    updateState: (id: number, state: string) =>
      mutate((projectName) => client.updateState({ project: projectName, id, state })),
    addComment: (id: number, text: string) =>
      mutate((projectName) => client.addComment({ project: projectName, id, text })),
    create: (input: { workItemType: string; title: string; description?: string }) =>
      mutate((projectName) => client.create({ project: projectName, ...input })),
    listTypes
  }
}
