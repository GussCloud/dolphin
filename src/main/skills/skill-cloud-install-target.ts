import type { SkillInstallDestination } from '../../shared/skill-install-contract'
import type { DolphinRuntimeService } from '../runtime/dolphin-runtime'

export async function classifySkillCloudInstallTarget(
  runtime: DolphinRuntimeService,
  input: { environmentId?: string; destination: SkillInstallDestination }
): Promise<'local' | 'remote'> {
  return input.environmentId || (await runtime.skillInstallDestinationUsesSsh(input.destination))
    ? 'remote'
    : 'local'
}
