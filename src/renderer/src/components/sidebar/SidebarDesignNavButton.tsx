import React from 'react'
import { PenTool } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { HideSidebarMenu } from './sidebar-nav-controls'

export function shouldShowDesignButton(
  settings: Partial<Pick<GlobalSettings, 'showDesignButton'>> | null | undefined
): boolean {
  return settings?.showDesignButton !== false
}

export function SidebarDesignNavButton(): React.JSX.Element | null {
  const visible = useAppStore((s) => shouldShowDesignButton(s.settings))
  const active = useAppStore((s) => s.activeView === 'design')
  const openDesignPage = useAppStore((s) => s.openDesignPage)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const hide = React.useCallback(() => {
    void updateSettings({ showDesignButton: false })
  }, [updateSettings])

  if (!visible) {
    return null
  }
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={openDesignPage}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
            active
              ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
              : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
          )}
        >
          <PenTool
            className={cn('size-4 shrink-0', !active && 'text-worktree-sidebar-foreground/30')}
            strokeWidth={active ? 2.25 : 1.75}
          />
          <span className="flex-1">
            {translate('auto.components.sidebar.SidebarNav.design', 'Design')}
          </span>
        </button>
      </ContextMenuTrigger>
      <HideSidebarMenu onHide={hide} />
    </ContextMenu>
  )
}
