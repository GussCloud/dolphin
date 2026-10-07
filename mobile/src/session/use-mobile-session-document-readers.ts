import { useCallback } from 'react'
import type { RpcFailure } from '../transport/types'
import { resolveMobileFileTabDoc } from '../files/mobile-file-tab-doc'
import { filePreviewTextRead } from '../files/mobile-file-preview-operations'
import { markdownTabRead } from './mobile-session-read-operations'
import {
  buildMarkdownDiskFallbackDoc,
  shouldReadMarkdownFromDiskAfterReadTabFailure
} from './mobile-markdown-disk-fallback'
import type { MobileSessionTab } from './mobile-session-route-types'
import type { MobileSessionTabApplicationModel } from './use-mobile-session-tab-application'
import { sessionCatalog } from '../i18n/catalogs/session'
import { translate } from '../i18n/mobile-locale-state'

export function useMobileSessionDocumentReaders(scope: MobileSessionTabApplicationModel) {
  const { worktreeId, client, setMarkdownDocs, setFileDocs } = scope
  const readMarkdownTab = useCallback(
    async (tab: Extract<MobileSessionTab, { type: 'markdown' }>) => {
      if (!client) {
        return
      }
      setMarkdownDocs((prev) => new Map(prev).set(tab.id, { status: 'loading' }))
      try {
        const response = await markdownTabRead.request(client, {
          worktree: `id:${worktreeId}`,
          tabId: tab.id
        })
        if (response.ok) {
          const result = markdownTabRead.interpret(response)
          setMarkdownDocs((prev) =>
            new Map(prev).set(tab.id, {
              status: 'ready',
              content: result.content,
              localContent: result.content,
              baseVersion: result.version,
              isDirty: false,
              editable: result.editable === true,
              stale: result.isDirty,
              readOnlyReason: result.readOnlyReason
            })
          )
          return
        }
        if (!shouldReadMarkdownFromDiskAfterReadTabFailure(response as RpcFailure)) {
          throw new Error((response as RpcFailure).error.message)
        }
        // Why: a headless host fails markdown.readTab (renderer_unavailable); fall back to the on-disk file for read-only render.
        const fallback = filePreviewTextRead.interpret(
          await filePreviewTextRead.request(client, {
            worktree: `id:${worktreeId}`,
            relativePath: tab.relativePath
          })
        )
        if (!fallback.accepted) {
          throw new Error(translate(sessionCatalog, 'readMarkdownFailed'))
        }
        const fileResult = fallback.value
        setMarkdownDocs((prev) =>
          new Map(prev).set(
            tab.id,
            buildMarkdownDiskFallbackDoc({
              content: fileResult.content,
              truncated: fileResult.truncated,
              tabIsDirty: tab.isDirty
            })
          )
        )
      } catch {
        setMarkdownDocs((prev) =>
          new Map(prev).set(tab.id, {
            status: 'error',
            message: translate(sessionCatalog, 'loadMarkdownFailed')
          })
        )
      }
    },
    [client, worktreeId]
  )

  const readFileTab = useCallback(
    async (tab: Extract<MobileSessionTab, { type: 'file' }>) => {
      if (!client) {
        return
      }
      setFileDocs((prev) => new Map(prev).set(tab.id, { status: 'loading' }))
      try {
        const doc = await resolveMobileFileTabDoc(client, {
          worktreeId,
          relativePath: tab.relativePath,
          diffSource: tab.diffSource
        })
        setFileDocs((prev) => new Map(prev).set(tab.id, doc))
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        const previewMessage =
          message === 'binary_file'
            ? translate(sessionCatalog, 'binaryPreviewUnavailable')
            : message === 'file_too_large'
              ? translate(sessionCatalog, 'fileTooLargeForPreview')
              : tab.diffSource === 'staged' || tab.diffSource === 'unstaged'
                ? translate(sessionCatalog, 'loadDiffPreviewFailed')
                : translate(sessionCatalog, 'loadFilePreviewFailed')
        setFileDocs((prev) =>
          new Map(prev).set(tab.id, {
            status: 'error',
            message: previewMessage
          })
        )
      }
    },
    [client, worktreeId]
  )
  return {
    readMarkdownTab,
    readFileTab
  }
}

export type MobileSessionDocumentReadersModel = MobileSessionTabApplicationModel &
  ReturnType<typeof useMobileSessionDocumentReaders>
