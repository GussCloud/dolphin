import { join } from 'node:path'
import { getAppEnvironment } from '../../shared/app-environment'
import { DesignStore } from './design-store'

let instance: DesignStore | null = null

export function getDesignStore(): DesignStore {
  instance ??= new DesignStore(() => join(getAppEnvironment().getPath('userData'), 'designs.json'))
  return instance
}
