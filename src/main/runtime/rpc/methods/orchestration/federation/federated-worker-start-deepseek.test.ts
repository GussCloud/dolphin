import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AGENT_SESSION_DEEPSEEK_RESUME_RUNTIME_CAPABILITY,
  DEEPSEEK_HOST_UPDATE_REQUIRED_MESSAGE,
  ORCHESTRATION_CONTRACT_RUNTIME_CAPABILITY,
  ORCHESTRATION_FEDERATION_RUNTIME_CAPABILITY
} from '../../../../../../shared/protocol-version'
import { DolphinRuntimeService } from '../../../../dolphin-runtime'
import { OrchestrationDb } from '../../../../orchestration/db'
import { startFederatedWorker } from './federated-worker-start'

describe('federated worker start with a DeepSeek agent', () => {
  const databases: OrchestrationDb[] = []

  afterEach(() => {
    for (const database of databases.splice(0)) {
      database.close()
    }
  })

  function start(peerCapabilities: string[], agent: string) {
    const db = new OrchestrationDb(':memory:')
    const runtime = new DolphinRuntimeService()
    runtime.setOrchestrationDb(db)
    databases.push(db)
    const run = db.createRun({
      objective: 'federated worker',
      coordinatorHandle: 'term_coord',
      coordinatorPaneKey: 'tab_coord:leaf_coord'
    })
    const task = db.createTask({ spec: 'remote work', runId: run.id })
    vi.spyOn(runtime, 'resolveOrchestrationWorkerServer').mockReturnValue({
      environmentId: 'environment_remote',
      name: 'remote',
      peerFingerprint: 'remote_peer',
      pairingRevision: 73
    })
    const remoteCall = vi
      .spyOn(runtime, 'callOrchestrationWorkerServer')
      .mockImplementation(async (_environmentId, method) => {
        if (method === 'status.get') {
          return {
            capabilities: [
              ORCHESTRATION_CONTRACT_RUNTIME_CAPABILITY,
              ORCHESTRATION_FEDERATION_RUNTIME_CAPABILITY,
              ...peerCapabilities
            ]
          }
        }
        throw new Error('attach not scripted')
      })
    const result = startFederatedWorker({
      params: {
        task: task.id,
        from: 'term_coord',
        on: 'remote',
        worktree: 'id:worktree_remote',
        agent
      },
      runtime,
      db,
      runId: run.id,
      task,
      orchestrationMutation: {
        callerFingerprint: 'caller',
        requestId: 'remote_start',
        method: 'orchestration.workerStart',
        payloadHash: 'payload'
      }
    })
    const attachCalls = () =>
      remoteCall.mock.calls.filter((call) => call[1] === 'orchestration.federationAttachStart')
    return { result, attachCalls }
  }

  it('refuses before any dispatch effect when the peer predates DeepSeek', async () => {
    const { result, attachCalls } = start([], 'deepseek')
    await expect(result).rejects.toMatchObject({
      code: 'capability_unsupported',
      message: DEEPSEEK_HOST_UPDATE_REQUIRED_MESSAGE
    })
    expect(attachCalls()).toHaveLength(0)
  })

  it('attaches when the peer advertises DeepSeek', async () => {
    const { result, attachCalls } = start(
      [AGENT_SESSION_DEEPSEEK_RESUME_RUNTIME_CAPABILITY],
      'deepseek'
    )
    await result
    expect(attachCalls()).toHaveLength(1)
  })

  it('leaves other agents on an older peer untouched', async () => {
    const { result, attachCalls } = start([], 'claude')
    await result
    expect(attachCalls()).toHaveLength(1)
  })
})
