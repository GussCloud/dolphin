import type { FsChangedPayload } from '../../../shared/filesystem-entry-types'

export const DOLPHIN_WORKTREE_FILE_CHANGE_EVENT = 'dolphin:worktree-file-change'

export type WorktreeFileChangeEventDetail = {
  payload: FsChangedPayload
  runtimeEnvironmentId: string | null
}
