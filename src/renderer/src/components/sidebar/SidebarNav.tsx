import React from 'react'
import {
  BookOpen,
  CalendarClock,
  EyeOff,
  Files,
  GitPullRequest,
  Search,
  Smartphone
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { useAzureDevOpsPullRequestsAvailable } from '@/hooks/useAzureDevOpsPullRequestsAvailable'
import { useShortcutKeyComboDetails } from '@/hooks/useShortcutLabel'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { useMobileSidebarOnboardingBadge } from './mobile-sidebar-onboarding-badge'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SetupGuideSidebarEntry } from './SetupGuideSidebarEntry'
import { SidebarTaskNavButton } from './SidebarTaskNavButton'
import { SidebarDesignNavButton } from './SidebarDesignNavButton'
import { HideSidebarMenu } from './sidebar-nav-controls'
import { translate } from '@/i18n/i18n'
import { lazyWithRetry } from '@/lib/lazy-with-retry'
import type { GlobalSettings } from '../../../../shared/global-settings-types'

export { getSetupGuideSidebarEntryReady, shouldShowSetupGuideEntry } from './SetupGuideSidebarEntry'
export { shouldShowDesignButton } from './SidebarDesignNavButton'

export function shouldShowMobileButton(
  settings: Partial<Pick<GlobalSettings, 'showMobileButton'>> | null | undefined
): boolean {
  return settings?.showMobileButton !== false
}

export function shouldShowAutomationsButton(
  settings: Partial<Pick<GlobalSettings, 'showAutomationsButton'>> | null | undefined
): boolean {
  return settings?.showAutomationsButton !== false
}

export function shouldShowAzurePrsButton(
  settings: Partial<Pick<GlobalSettings, 'showAzurePrsButton'>> | null | undefined,
  azureDevOpsAvailable: boolean
): boolean {
  return azureDevOpsAvailable && settings?.showAzurePrsButton !== false
}

export function shouldShowArtifactsButton(
  settings: Partial<Pick<GlobalSettings, 'showArtifactsButton'>> | null | undefined
): boolean {
  return settings?.showArtifactsButton === true
}

export function shouldShowSkillsButton(
  settings: Partial<Pick<GlobalSettings, 'showSkillsButton'>> | null | undefined
): boolean {
  return settings?.showSkillsButton === true
}

export function shouldShowAgentDashboardButton(
  settings: Partial<Pick<GlobalSettings, 'experimentalAgentDashboardPopout'>> | null | undefined
): boolean {
  return settings?.experimentalAgentDashboardPopout === true
}

const AgentDashboardSidebarEntry = lazyWithRetry(() => import('./AgentDashboardSidebarEntry'))

const SidebarNav = React.memo(function SidebarNav() {
  // Why: this memo boundary needs its own language subscription, while
  // translate() preserves Dolphin's pseudo-localization behavior.
  useTranslation()
  const worktreePaletteShortcutCombos = useShortcutKeyComboDetails('worktree.palette')
  const openAutomationsPage = useAppStore((s) => s.openAutomationsPage)
  const openMobilePage = useAppStore((s) => s.openMobilePage)
  const openArtifactsPage = useAppStore((s) => s.openArtifactsPage)
  const openAzurePrsPage = useAppStore((s) => s.openAzurePrsPage)
  const openSkillsPage = useAppStore((s) => s.openSkillsPage)
  const openModal = useAppStore((s) => s.openModal)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const activeView = useAppStore((s) => s.activeView)
  const showAgentDashboardButton = useAppStore((s) => shouldShowAgentDashboardButton(s.settings))
  const showAutomationsButton = useAppStore((s) => shouldShowAutomationsButton(s.settings))
  const showMobileButton = useAppStore((s) => shouldShowMobileButton(s.settings))
  const showArtifactsButton = useAppStore((s) => shouldShowArtifactsButton(s.settings))
  const showSkillsButton = useAppStore((s) => shouldShowSkillsButton(s.settings))
  const azureDevOpsAvailable = useAzureDevOpsPullRequestsAvailable()
  const showAzurePrsButton = useAppStore((s) =>
    shouldShowAzurePrsButton(s.settings, azureDevOpsAvailable)
  )
  const automationsActive = activeView === 'automations'
  const azurePrsActive = activeView === 'azure-prs'
  const mobileActive = activeView === 'mobile'
  const artifactsActive = activeView === 'artifacts'
  const skillsActive = activeView === 'skills'
  const mobileOnboardingBadge = useMobileSidebarOnboardingBadge(showMobileButton)
  const hideAutomationsButton = React.useCallback(() => {
    void updateSettings({ showAutomationsButton: false })
  }, [updateSettings])
  const hideAzurePrsButton = React.useCallback(() => {
    void updateSettings({ showAzurePrsButton: false })
  }, [updateSettings])
  const hideMobileButton = React.useCallback(() => {
    void updateSettings({ showMobileButton: false })
  }, [updateSettings])
  const hideArtifactsButton = React.useCallback(() => {
    void updateSettings({ showArtifactsButton: false })
  }, [updateSettings])
  const hideSkillsButton = React.useCallback(() => {
    void updateSettings({ showSkillsButton: false })
  }, [updateSettings])

  return (
    <div
      className="flex flex-col gap-0.5 px-2 pt-2 pb-1"
      data-contextual-tour-target="sidebar-navigation"
    >
      <button
        type="button"
        onClick={() => openModal('worktree-palette')}
        aria-label={translate(
          'auto.components.sidebar.SidebarNav.0c3395fd32',
          'Search worktrees and browser tabs'
        )}
        // Why: an input-like surface so the entry reads as search, not as another nav row.
        className="mb-1 flex h-8 w-full items-center gap-2 rounded-md border border-worktree-sidebar-border bg-worktree-sidebar-foreground/5 px-2 text-left text-[13px] tracking-tight text-worktree-sidebar-foreground/50 transition-colors hover:bg-worktree-sidebar-foreground/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring"
      >
        <Search
          className="size-4 shrink-0 text-worktree-sidebar-foreground/50"
          strokeWidth={1.75}
        />
        <span className="min-w-0 flex-1 truncate">
          {translate(
            'auto.components.sidebar.SidebarNav.searchPlaceholder',
            'Search workspaces, branches…'
          )}
        </span>
        <span
          data-search-shortcut=""
          className="pointer-events-none flex shrink-0 items-center gap-1"
        >
          {worktreePaletteShortcutCombos.map((combo) => (
            <ShortcutKeyCombo
              key={combo.keys.join('-')}
              keys={combo.keys}
              doubleTap={combo.doubleTap}
              className="inline-flex gap-0.5"
              keyCapClassName="min-w-4 border-worktree-sidebar-border/80 bg-worktree-sidebar-foreground/8 px-1 py-px text-[9px] text-worktree-sidebar-foreground/55 shadow-none"
              separatorClassName="text-[9px] text-worktree-sidebar-foreground/45"
            />
          ))}
        </span>
      </button>
      <SetupGuideSidebarEntry />
      <SidebarTaskNavButton />
      {showArtifactsButton ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              type="button"
              onClick={openArtifactsPage}
              aria-current={artifactsActive ? 'page' : undefined}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] font-medium tracking-tight transition-colors',
                artifactsActive
                  ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
                  : 'text-worktree-sidebar-foreground/85 hover:bg-worktree-sidebar-foreground/8'
              )}
            >
              <Files
                className={cn(
                  'size-4 shrink-0',
                  !artifactsActive && 'text-worktree-sidebar-foreground/50'
                )}
                strokeWidth={artifactsActive ? 2.25 : 1.75}
              />
              <span className="flex-1">
                {translate('auto.components.sidebar.SidebarNav.artifacts', 'Artifacts')}
              </span>
            </button>
          </ContextMenuTrigger>
          <HideSidebarMenu onHide={hideArtifactsButton} />
        </ContextMenu>
      ) : null}
      {showSkillsButton ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              type="button"
              onClick={openSkillsPage}
              aria-current={skillsActive ? 'page' : undefined}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] font-medium tracking-tight transition-colors',
                skillsActive
                  ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
                  : 'text-worktree-sidebar-foreground/85 hover:bg-worktree-sidebar-foreground/8'
              )}
            >
              <BookOpen
                className={cn(
                  'size-4 shrink-0',
                  !skillsActive && 'text-worktree-sidebar-foreground/50'
                )}
                strokeWidth={skillsActive ? 2.25 : 1.75}
              />
              <span className="flex-1">
                {translate('auto.components.sidebar.SidebarNav.skills', 'Skills')}
              </span>
            </button>
          </ContextMenuTrigger>
          <HideSidebarMenu onHide={hideSkillsButton} />
        </ContextMenu>
      ) : null}
      {showAutomationsButton ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              type="button"
              onClick={openAutomationsPage}
              aria-current={automationsActive ? 'page' : undefined}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] font-medium tracking-tight transition-colors',
                automationsActive
                  ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
                  : 'text-worktree-sidebar-foreground/85 hover:bg-worktree-sidebar-foreground/8'
              )}
            >
              <CalendarClock
                className={cn(
                  'size-4 shrink-0',
                  !automationsActive && 'text-worktree-sidebar-foreground/50'
                )}
                strokeWidth={automationsActive ? 2.25 : 1.75}
              />
              <span className="flex-1">
                {translate('auto.components.sidebar.SidebarNav.f323383e9a', 'Automations')}
              </span>
            </button>
          </ContextMenuTrigger>
          <HideSidebarMenu onHide={hideAutomationsButton} />
        </ContextMenu>
      ) : null}
      {showAzurePrsButton ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              type="button"
              onClick={openAzurePrsPage}
              aria-current={azurePrsActive ? 'page' : undefined}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] font-medium tracking-tight transition-colors',
                azurePrsActive
                  ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
                  : 'text-worktree-sidebar-foreground/85 hover:bg-worktree-sidebar-foreground/8'
              )}
            >
              <GitPullRequest
                className={cn(
                  'size-4 shrink-0',
                  !azurePrsActive && 'text-worktree-sidebar-foreground/50'
                )}
                strokeWidth={azurePrsActive ? 2.25 : 1.75}
              />
              <span className="flex-1">
                {translate('auto.components.sidebar.SidebarNav.azurePrs', 'Azure (PRs)')}
              </span>
            </button>
          </ContextMenuTrigger>
          <HideSidebarMenu onHide={hideAzurePrsButton} />
        </ContextMenu>
      ) : null}
      <SidebarDesignNavButton />
      {showAgentDashboardButton ? (
        <React.Suspense fallback={null}>
          <AgentDashboardSidebarEntry />
        </React.Suspense>
      ) : null}
      {showMobileButton ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                'group flex w-full items-center rounded-md text-[13px] font-medium tracking-tight transition-colors',
                mobileActive
                  ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
                  : 'text-worktree-sidebar-foreground/85 hover:bg-worktree-sidebar-foreground/8'
              )}
            >
              <button
                type="button"
                onClick={() => {
                  mobileOnboardingBadge.dismiss()
                  openMobilePage()
                }}
                aria-current={mobileActive ? 'page' : undefined}
                className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left"
              >
                <Smartphone
                  className={cn(
                    'size-4 shrink-0',
                    !mobileActive && 'text-worktree-sidebar-foreground/50'
                  )}
                  strokeWidth={mobileActive ? 2.25 : 1.75}
                />
                <span className="min-w-0 flex-1 truncate">
                  {translate('auto.components.sidebar.SidebarNav.1b5c41caee', 'Dolphin Mobile')}
                </span>
                {mobileOnboardingBadge.visible ? (
                  <span className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold text-primary-foreground">
                    {translate('auto.components.sidebar.SidebarNav.c86d83b5c3', 'New')}
                  </span>
                ) : null}
              </button>
              {mobileOnboardingBadge.hasPairedDevice ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className={cn(
                        'mr-1 text-worktree-sidebar-foreground/55 hover:bg-worktree-sidebar-foreground/10 hover:text-worktree-sidebar-foreground',
                        mobileActive &&
                          'text-worktree-sidebar-accent-foreground/70 hover:text-worktree-sidebar-accent-foreground'
                      )}
                      onClick={(event) => {
                        event.stopPropagation()
                        hideMobileButton()
                      }}
                      aria-label={translate(
                        'auto.components.sidebar.SidebarNav.d599269755',
                        'Hide from sidebar'
                      )}
                    >
                      <EyeOff className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    {translate(
                      'auto.components.sidebar.SidebarNav.d599269755',
                      'Hide from sidebar'
                    )}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </ContextMenuTrigger>
          <HideSidebarMenu onHide={hideMobileButton} />
        </ContextMenu>
      ) : null}
    </div>
  )
})

export default SidebarNav
