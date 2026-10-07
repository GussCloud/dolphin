import { View } from 'react-native'
import { Monitor } from 'lucide-react-native'
import type { SmartModeAvailabilityInput } from '../tasks/mobile-smart-source-modes'
import type { PasteRepoCandidate } from '../tasks/smart-source-paste-intent'
import type { useMobileComposerSource } from '../tasks/use-mobile-composer-source'
import { colors } from '../theme/mobile-theme'
import { MobileAgentIcon } from './MobileAgentIcon'
import type { NewWorktreeAgentOption } from './new-worktree-agent-selection'
import { newWorktreeFormStyles as styles } from './new-worktree-form-styles'
import type { MobileWorkspaceRepo } from './new-worktree-modal-types'
import type {
  NewWorkspaceProjectOption,
  NewWorkspaceRunTargetOption
} from './new-workspace-project-targets'
import { getMobileWorkspaceRepoBadgeColor } from './new-worktree-modal-types'
import { PickerListDrawer } from './PickerListDrawer'
import { SetupHookTrustDrawer, type SetupTrustPrompt } from './SetupHookTrustDrawer'
import { SmartWorkspaceSourceDrawer } from './SmartWorkspaceSourceDrawer'
import type { ExtraProjectPickerItem } from './use-new-workspace-multi-project'
import type { NewWorktreeDrawerView } from './use-new-worktree-drawer-navigation'
import { componentsNewWorkspaceCatalog } from '../i18n/catalogs/components-new-workspace'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

type Composer = ReturnType<typeof useMobileComposerSource>

export function NewWorktreeModalDrawers(props: {
  visible: boolean
  drawerView: NewWorktreeDrawerView
  client: Parameters<typeof SmartWorkspaceSourceDrawer>[0]['client']
  composer: Composer
  sourceAvailability: SmartModeAvailabilityInput
  selectedRepo: MobileWorkspaceRepo | null
  repos: MobileWorkspaceRepo[]
  pasteRepos: PasteRepoCandidate[]
  sshReady: boolean
  projectPickerItems: NewWorkspaceProjectOption<MobileWorkspaceRepo>[]
  selectedProjectId: string | null
  extraProjectPickerItems: ExtraProjectPickerItem[]
  runTargetPickerItems: NewWorkspaceRunTargetOption<MobileWorkspaceRepo>[]
  pickerAgentOptions: NewWorktreeAgentOption[]
  selectedAgent: NewWorktreeAgentOption
  setupTrustPrompt: SetupTrustPrompt | null
  creating: boolean
  onSourceRepoChange: (repo: MobileWorkspaceRepo) => void
  onRepoChange: (repo: MobileWorkspaceRepo) => void
  onExtraProjectAdd: (repoId: string) => void
  onAgentChange: (agent: NewWorktreeAgentOption) => void
  onTransitionToForm: () => void
  onApproveSetupTrust: (alwaysTrust: boolean) => void
  onSkipSetupTrust: () => void
  onCloseSetupTrust: () => void
}) {
  const t = useMobileTranslation(componentsNewWorkspaceCatalog)
  return (
    <>
      <SmartWorkspaceSourceDrawer
        visible={props.visible && props.drawerView === 'source'}
        client={props.client}
        composer={props.composer}
        availability={props.sourceAvailability}
        repoId={props.selectedRepo?.id ?? null}
        repos={props.pasteRepos}
        sshReady={props.sshReady}
        onRepoChange={(repoId) => {
          const nextRepo = props.repos.find((repo) => repo.id === repoId)
          if (nextRepo) {
            props.onSourceRepoChange(nextRepo)
          }
        }}
        onClose={props.onTransitionToForm}
      />

      <PickerListDrawer
        visible={props.visible && props.drawerView === 'project'}
        title={t('project')}
        items={props.projectPickerItems}
        selectedId={props.selectedProjectId ?? ''}
        onSelect={(item) => props.onRepoChange(item.repo)}
        onClose={props.onTransitionToForm}
        renderIcon={(item) => (
          <View
            style={[
              styles.repoDot,
              { backgroundColor: getMobileWorkspaceRepoBadgeColor(item.repo) }
            ]}
          />
        )}
      />

      <PickerListDrawer
        visible={props.visible && props.drawerView === 'extraProject'}
        title={t('addProject')}
        items={props.extraProjectPickerItems}
        selectedId=""
        onSelect={(item) => props.onExtraProjectAdd(item.id)}
        onClose={props.onTransitionToForm}
        renderIcon={(item) => (
          <View
            style={[
              styles.repoDot,
              { backgroundColor: getMobileWorkspaceRepoBadgeColor(item.repo) }
            ]}
          />
        )}
      />

      <PickerListDrawer
        visible={props.visible && props.drawerView === 'runTarget'}
        title={t('runOn')}
        items={props.runTargetPickerItems}
        selectedId={props.selectedRepo?.id ?? ''}
        onSelect={(item) => props.onRepoChange(item.repo)}
        onClose={props.onTransitionToForm}
        renderIcon={() => <Monitor size={16} color={colors.textMuted} />}
      />

      <PickerListDrawer
        visible={props.visible && props.drawerView === 'agent'}
        title={t('agent')}
        items={props.pickerAgentOptions}
        selectedId={props.selectedAgent.id}
        onSelect={props.onAgentChange}
        onClose={props.onTransitionToForm}
        renderIcon={(agent) => <MobileAgentIcon agentId={agent.id} size={18} />}
      />

      <SetupHookTrustDrawer
        visible={props.visible && props.drawerView === 'trust' && props.setupTrustPrompt != null}
        prompt={props.setupTrustPrompt}
        busy={props.creating}
        onRunOnce={() => props.onApproveSetupTrust(false)}
        onAlwaysTrust={() => props.onApproveSetupTrust(true)}
        onDontRun={props.onSkipSetupTrust}
        onClose={props.onCloseSetupTrust}
      />
    </>
  )
}
