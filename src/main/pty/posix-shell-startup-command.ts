import { basename, win32 as pathWin32 } from 'node:path'

export const POSIX_SHELL_STARTUP_COMMAND_ENV = 'DOLPHIN_POSIX_SHELL_STARTUP_COMMAND'

export function supportsPosixShellStartupCommand(shellPath: string): boolean {
  const shellName = pathWin32.basename(basename(shellPath)).toLowerCase()
  return shellName === 'bash' || shellName === 'zsh' || shellName === 'fish'
}

export function getBashStartupCommandPromptBlock(): string {
  return `if [[ \${${POSIX_SHELL_STARTUP_COMMAND_ENV}+present} == present ]]; then
  __dolphin_remove_startup_command_prompt_hook() {
    local __dolphin_item
    local -a __dolphin_remaining=()
    if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
      for __dolphin_item in "\${PROMPT_COMMAND[@]+"\${PROMPT_COMMAND[@]}"}"; do
        [[ "$__dolphin_item" == "__dolphin_run_startup_command" ]] || __dolphin_remaining+=("$__dolphin_item")
      done
      PROMPT_COMMAND=("\${__dolphin_remaining[@]+"\${__dolphin_remaining[@]}"}")
    else
      for __dolphin_item in "\${__dolphin_prompt_command_suffix[@]+"\${__dolphin_prompt_command_suffix[@]}"}"; do
        [[ "$__dolphin_item" == "__dolphin_run_startup_command" ]] || __dolphin_remaining+=("$__dolphin_item")
      done
      __dolphin_prompt_command_suffix=("\${__dolphin_remaining[@]+"\${__dolphin_remaining[@]}"}")
    fi
  }
  __dolphin_run_startup_command() {
    local __dolphin_command="$${POSIX_SHELL_STARTUP_COMMAND_ENV}" __dolphin_status
    unset ${POSIX_SHELL_STARTUP_COMMAND_ENV}
    __dolphin_remove_startup_command_prompt_hook
    unset -f __dolphin_remove_startup_command_prompt_hook
    builtin history -s "$__dolphin_command" 2>/dev/null || true
    builtin printf '%s\n' "$__dolphin_command"
    eval "$__dolphin_command"
    __dolphin_status=$?
    unset -f __dolphin_run_startup_command
    return "$__dolphin_status"
  }
  __dolphin_append_prompt_command "__dolphin_run_startup_command"
fi`
}
