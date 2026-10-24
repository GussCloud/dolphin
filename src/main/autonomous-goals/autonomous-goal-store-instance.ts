import { join } from 'node:path'
import { getAppEnvironment } from '../../shared/app-environment'
import { AutonomousGoalStore } from './autonomous-goal-store'

let instance: AutonomousGoalStore | null = null

export function getAutonomousGoalStore(): AutonomousGoalStore {
  instance ??= new AutonomousGoalStore(() =>
    join(getAppEnvironment().getPath('userData'), 'autonomous-goals.json')
  )
  return instance
}
