import type { KeybindingActionId } from '../../shared/keybindings'
import { translateMain } from '../i18n/main-i18n'
import type { AppearanceMenuKey, AppearanceMenuState } from './register-app-menu'

export function buildAppearanceSubmenu({
  appearance,
  shortcutLabel,
  onToggleAppearance,
  onToggleLeftSidebar,
  onToggleRightSidebar
}: {
  appearance: AppearanceMenuState
  shortcutLabel: (actionId: KeybindingActionId) => string
  onToggleAppearance: (key: AppearanceMenuKey) => void
  onToggleLeftSidebar: () => void
  onToggleRightSidebar: () => void
}): Electron.MenuItemConstructorOptions {
  // Why: mirror VS Code's View > Appearance submenu so users can toggle
  // sidebar/status-bar/tasks-button/titlebar-activity from the menu bar as
  // well as from the settings pane. Electron doesn't reactively update
  // menu items when the backing state changes, so rebuildAppMenu() must be
  // called after every settings update — each build reads current
  // appearance state through getAppearanceState() and produces a fresh
  // template with accurate `checked` values.
  const appearanceCheckbox = (
    key: AppearanceMenuKey,
    label: string
  ): Electron.MenuItemConstructorOptions => ({
    label,
    type: 'checkbox',
    checked: appearance[key],
    click: () => onToggleAppearance(key)
  })

  return {
    label: translateMain('menu.appearance', 'Appearance'),
    submenu: [
      {
        // Why: display-only shortcut hint — not a real accelerator. Cmd/Ctrl+B
        // is intercepted in createMainWindow.ts's before-input-event handler
        // with a TipTap-bold carve-out for markdown editors. Binding the
        // accelerator here would steal the chord before that carve-out can
        // fire. Sidebar open/closed lives in the renderer store (non-persisted),
        // so we forward a toggle request rather than mirroring state in main.
        label: `${translateMain('menu.toggleLeftSidebar', 'Toggle Left Sidebar')}\t${shortcutLabel('sidebar.left.toggle')}`,
        click: () => onToggleLeftSidebar()
      },
      {
        // Why: display-only shortcut hint for the same reason as above.
        label: `${translateMain('menu.toggleRightSidebar', 'Toggle Right Sidebar')}\t${shortcutLabel('sidebar.right.toggle')}`,
        click: () => onToggleRightSidebar()
      },
      appearanceCheckbox(
        'statusBarVisible',
        translateMain('menu.showStatusBar', 'Show Status Bar')
      ),
      { type: 'separator' },
      appearanceCheckbox(
        'showTasksButton',
        translateMain('menu.showTasksButton', 'Show Tasks Button')
      ),
      appearanceCheckbox(
        'showAutomationsButton',
        translateMain('menu.showAutomationsButton', 'Show Automations Button')
      ),
      appearanceCheckbox(
        'showAzurePrsButton',
        translateMain('menu.showAzurePrsButton', 'Show Azure (PRs) Button')
      ),
      appearanceCheckbox(
        'showMobileButton',
        translateMain('menu.showMobileButton', 'Show Dolphin Mobile Button')
      ),
      appearanceCheckbox(
        'showTitlebarAppName',
        translateMain('menu.showTitlebarAppName', 'Show Titlebar App Name')
      )
    ]
  }
}
