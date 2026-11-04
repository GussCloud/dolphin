// How close a coordinator is to its context window at a turn end, from one transcript tail read.
import type { AutonomousGoalAgent } from '../../shared/autonomous-goal-types'
import {
  coordinatorTranscriptPlatform,
  isCoordinatorContextMeasurable
} from '../../shared/autonomous-coordinator-launch-env'
import type { CoordinatorContextReading } from './autonomous-goal-context-probe'
import { resolveCoordinatorContextWindow } from './autonomous-goal-context-window'

/** Share of the current model's window to hand off at; the coordinator runs without auto-compaction. */
export const AUTONOMOUS_GOAL_ROTATE_AT_WINDOW_SHARE = 0.9
/** Past this share the rotation is forced: no handoff note, no cooldown. */
export const AUTONOMOUS_GOAL_FORCE_ROTATE_AT_WINDOW_SHARE = 0.95
/** Without a measurable transcript (SSH, WSL), rotate on turn count instead. */
export const AUTONOMOUS_GOAL_ROTATE_FALLBACK_TURNS = 40

export type ContextPressure = 'none' | 'rotate' | 'force'

export function rotationThreshold(windowTokens: number): number {
  return Math.floor(windowTokens * AUTONOMOUS_GOAL_ROTATE_AT_WINDOW_SHARE)
}

export function forcedRotationThreshold(windowTokens: number): number {
  return Math.floor(windowTokens * AUTONOMOUS_GOAL_FORCE_ROTATE_AT_WINDOW_SHARE)
}

export async function assessCoordinatorContextPressure(args: {
  agent: AutonomousGoalAgent
  transcriptPath: string | undefined
  /** The transcript the last rotation left; a reading of it is the old session's size. */
  staleTranscriptPath: string | undefined
  connectionId: string | null | undefined
  sessionModel: string | undefined
  turnsSinceRotation: number
  hostPlatform: NodeJS.Platform
  readContext: (
    agent: AutonomousGoalAgent,
    transcriptPath: string
  ) => Promise<CoordinatorContextReading | null>
}): Promise<ContextPressure> {
  const { transcriptPath, hostPlatform } = args
  // Why: the launch decided auto-compaction from this same rule; unmeasurable panes count turns.
  if (
    transcriptPath &&
    transcriptPath !== args.staleTranscriptPath &&
    isCoordinatorContextMeasurable({
      remote: args.connectionId !== null,
      launchPlatform: coordinatorTranscriptPlatform(transcriptPath, hostPlatform),
      hostPlatform
    })
  ) {
    const reading = await args.readContext(args.agent, transcriptPath)
    if (reading) {
      const window = resolveCoordinatorContextWindow({
        agent: args.agent,
        reading,
        sessionModel: args.sessionModel
      })
      if (reading.contextTokens >= forcedRotationThreshold(window)) {
        return 'force'
      }
      return reading.contextTokens >= rotationThreshold(window) ? 'rotate' : 'none'
    }
  }
  return args.turnsSinceRotation >= AUTONOMOUS_GOAL_ROTATE_FALLBACK_TURNS ? 'rotate' : 'none'
}
