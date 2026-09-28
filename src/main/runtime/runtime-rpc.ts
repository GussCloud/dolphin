// Why: the single security boundary for the bundled CLI — auth-token enforcement, metadata publication, transport orchestration.
import { RuntimeRpcShutdown } from './runtime-rpc/runtime-rpc-shutdown'
import type { DolphinRuntimeRpcServerOptions } from './runtime-rpc/runtime-rpc-pairing-types'

export type {
  PairingOfferUnavailableReason,
  PairingOfferUnavailable
} from './runtime-rpc/runtime-rpc-pairing-types'
export type { MobilePairingConnectionContext } from './runtime-rpc/runtime-rpc-pairing-types'
export type { RuntimeLongPollClass } from './runtime-rpc/runtime-rpc-long-poll'
export { classifyRuntimeLongPoll } from './runtime-rpc/runtime-rpc-long-poll'

export class DolphinRuntimeRpcServer extends RuntimeRpcShutdown {
  constructor(options: DolphinRuntimeRpcServerOptions) {
    super(options)
  }
}

export {
  RUNTIME_SOCKET_NAME_REGEX,
  sweepOrphanedRuntimeSockets,
  createRuntimeTransportMetadata
} from './runtime-rpc/runtime-rpc-socket-metadata'
