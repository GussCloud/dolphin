export const DOLPHIN_EDITOR_SAVE_DIRTY_FILES_EVENT = 'dolphin:editor-save-dirty-files'
export const DOLPHIN_EDITOR_PREPARE_HOT_EXIT_EVENT = 'dolphin:editor-prepare-hot-exit'

export type EditorSaveDirtyFilesDetail = {
  claim: () => void
  resolve: () => void
  reject: (message: string) => void
}

export type EditorPrepareHotExitDetail = EditorSaveDirtyFilesDetail
