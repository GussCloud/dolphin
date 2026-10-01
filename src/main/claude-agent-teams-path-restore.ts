/** Env var carrying the ordered Agent Teams PATH dirs (highest precedence first, platform delimiter). */
export const AGENT_TEAMS_SHIM_PATH_DIRS_ENV = 'DOLPHIN_AGENT_TEAMS_SHIM_PATH_DIRS'

/**
 * Re-leads PATH with the Agent Teams shim dirs after the user's startup files ran.
 * Bash and zsh (under `emulate -L zsh`) both run it.
 */
export const AGENT_TEAMS_PATH_RESTORE_BLOCK = `__dolphin_restore_agent_teams_path() {
  local __dolphin_dirs="\${${AGENT_TEAMS_SHIM_PATH_DIRS_ENV}:-\${DOLPHIN_AGENT_TEAMS_SHIM_DIR:-}}"
  [[ -n "$__dolphin_dirs" ]] || return 0
  case "\${OSTYPE:-}" in
    msys*|cygwin*)
      # Why: the list is Windows-form (semicolons, drive letters) but MSYS $PATH is POSIX.
      __dolphin_dirs="$(cygpath -u -p "$__dolphin_dirs" 2>/dev/null)" || return 0 ;;
    *)
      # Why: a Windows-form list means nothing to a non-MSYS shell and would split on its drive colon.
      if [[ "$__dolphin_dirs" == *'\\'* || "$__dolphin_dirs" == *';'* ]]; then return 0; fi ;;
  esac
  local __dolphin_rest="$__dolphin_dirs:" __dolphin_path=":$PATH:" __dolphin_prefix="" __dolphin_dir
  while [[ -n "$__dolphin_rest" ]]; do
    __dolphin_dir="\${__dolphin_rest%%:*}"
    __dolphin_rest="\${__dolphin_rest#*:}"
    [[ -n "$__dolphin_dir" ]] || continue
    __dolphin_prefix="$__dolphin_prefix$__dolphin_dir:"
    while [[ "$__dolphin_path" == *":$__dolphin_dir:"* ]]; do
      __dolphin_path="\${__dolphin_path/":$__dolphin_dir:"/:}"
    done
  done
  [[ -n "$__dolphin_prefix" && ":$PATH:" != ":$__dolphin_prefix"* ]] || return 0
  __dolphin_path="\${__dolphin_path#:}"
  __dolphin_path="\${__dolphin_path%:}"
  export PATH="\${__dolphin_prefix%:}\${__dolphin_path:+:$__dolphin_path}"
}
__dolphin_restore_agent_teams_path`
