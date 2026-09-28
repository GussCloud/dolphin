import type {
  FindDolphinProfileProjectsByPathArgs,
  FindDolphinProfileProjectsByPathResult
} from '../../shared/dolphin-profiles'
import { getDolphinProfileListState } from './profile-index-store'
import { readProfileState } from './profile-project-state-file'
import { repoPhysicalKey } from './profile-project-worktree-identity'

function cleanOptionalString(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function findDolphinProfileProjectsByPath(
  args: FindDolphinProfileProjectsByPathArgs,
  userDataPath: string
): FindDolphinProfileProjectsByPathResult {
  const path = args.path.trim()
  if (!path) {
    throw new Error('invalid_dolphin_profile_project_path')
  }

  const excludeProfileId = cleanOptionalString(args.excludeProfileId)
  const candidateKey = repoPhysicalKey({
    path,
    connectionId: cleanOptionalString(args.connectionId),
    executionHostId: args.executionHostId ?? undefined
  })
  const projects: FindDolphinProfileProjectsByPathResult['projects'] = []

  for (const profile of getDolphinProfileListState(userDataPath).profiles) {
    if (profile.id === excludeProfileId) {
      continue
    }
    const state = readProfileState(profile.id, userDataPath)
    for (const repo of state.repos) {
      if (repoPhysicalKey(repo) !== candidateKey) {
        continue
      }
      projects.push({
        profileId: profile.id,
        profileName: profile.name,
        profileKind: profile.kind,
        repoId: repo.id,
        repoName: repo.displayName || repo.path
      })
    }
  }

  return { projects }
}
