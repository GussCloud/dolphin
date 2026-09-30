import { bindDeferredRpcOperation, defineRpcOperation } from '../transport/rpc-operation'
import { rpcResultVariant } from '../transport/rpc-operation-result-reader'
import {
  desktopUpdateInstallSchema,
  desktopUpdaterSnapshotSchema
} from './desktop-update-reply-schema'

/** The Home card's read of the desktop's own updater. Decorative: a refusal means "no offer". */
export const desktopUpdaterStatusRead = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'updater.home-status-or-skip',
    method: 'updater.getStatus',
    acceptance: 'success-result-or-skip',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('desktop-updater-status', desktopUpdaterSnapshotSchema)
  })
)

/** Polled while an update the user confirmed is running; the host's message is what the tag shows. */
export const desktopUpdaterStatusPoll = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'updater.run-status',
    method: 'updater.getStatus',
    acceptance: 'require-result-or-throw-message',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('desktop-updater-status', desktopUpdaterSnapshotSchema)
  })
)

export const desktopUpdateDownload = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'updater.download',
    method: 'updater.download',
    acceptance: 'require-result-or-throw-message',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('desktop-updater-status', desktopUpdaterSnapshotSchema)
  })
)

export const desktopUpdateInstall = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'updater.install',
    method: 'updater.install',
    acceptance: 'require-result-or-throw-message',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('desktop-update-install', desktopUpdateInstallSchema)
  })
)
