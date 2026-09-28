export const BASH_PROMPT_COMMAND_COMPOSITION_BLOCK = `__dolphin_normalize_prompt_command_part() {
  local __dolphin_value="$1" __dolphin_output_name="$2" __dolphin_character __dolphin_chunk
  local __dolphin_value_length=\${#1} __dolphin_suffix_length=0 __dolphin_backslash_length=0
  local __dolphin_output_length __dolphin_scan_start
  while (( __dolphin_value_length - __dolphin_suffix_length >= 1024 )); do
    __dolphin_scan_start=$(( __dolphin_value_length - __dolphin_suffix_length - 1024 ))
    __dolphin_chunk="\${__dolphin_value:__dolphin_scan_start:1024}"
    case "$__dolphin_chunk" in
      *[!$' \\t\\n;']*) break ;;
      *) __dolphin_suffix_length=$(( __dolphin_suffix_length + 1024 )) ;;
    esac
  done
  while (( __dolphin_suffix_length < __dolphin_value_length )); do
    __dolphin_character="\${__dolphin_value: -__dolphin_suffix_length - 1:1}"
    case "$__dolphin_character" in
      ' '|$'\\t'|$'\\n'|';') __dolphin_suffix_length=$(( __dolphin_suffix_length + 1 )) ;;
      *) break ;;
    esac
  done
  __dolphin_output_length=$(( \${#__dolphin_value} - __dolphin_suffix_length ))
  while (( __dolphin_output_length - __dolphin_backslash_length >= 1024 )); do
    __dolphin_scan_start=$(( __dolphin_output_length - __dolphin_backslash_length - 1024 ))
    __dolphin_chunk="\${__dolphin_value:__dolphin_scan_start:1024}"
    case "$__dolphin_chunk" in
      *[!\\\\]*) break ;;
      *) __dolphin_backslash_length=$(( __dolphin_backslash_length + 1024 )) ;;
    esac
  done
  while (( __dolphin_backslash_length < __dolphin_output_length )); do
    __dolphin_character="\${__dolphin_value:__dolphin_output_length - __dolphin_backslash_length - 1:1}"
    [[ "$__dolphin_character" == '\\' ]] || break
    __dolphin_backslash_length=$(( __dolphin_backslash_length + 1 ))
  done
  # Preserve the first separator when an odd backslash run escapes it.
  if (( __dolphin_suffix_length > 0 && __dolphin_backslash_length % 2 == 1 )); then
    __dolphin_suffix_length=$(( __dolphin_suffix_length - 1 ))
    __dolphin_backslash_length=0
  fi
  __dolphin_output_length=$(( \${#__dolphin_value} - __dolphin_suffix_length ))
  __dolphin_value="\${__dolphin_value:0:__dolphin_output_length}"
  # Bash 4.4-5.0 scalar prompt evaluation preserves an odd terminal backslash.
  if (( __dolphin_suffix_length == 0 && ((BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 4) || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] == 0)) && __dolphin_backslash_length % 2 == 1 )); then
    __dolphin_value="$__dolphin_value\\\\"
  fi
  printf -v "$__dolphin_output_name" '%s' "$__dolphin_value"
}
__dolphin_restore_prompt_status() {
  return "$1"
}
__dolphin_update_user_debug_trap() {
  local __dolphin_debug_trap_spec="$1" __dolphin_unchanged_debug_trap_spec="$2"
  local __dolphin_debug_trap_command
  [[ "$__dolphin_debug_trap_spec" != "$__dolphin_unchanged_debug_trap_spec" ]] || return 0
  [[ "$__dolphin_debug_trap_spec" != "trap -- '__dolphin_osc133_preexec' DEBUG" ]] || return 0
  if [[ -z "$__dolphin_debug_trap_spec" ]]; then
    __dolphin_user_debug_trap=""
    unset __dolphin_chained_debug_trap
    return 0
  fi
  __dolphin_debug_trap_command="\${__dolphin_debug_trap_spec#trap -- }"
  __dolphin_debug_trap_command="\${__dolphin_debug_trap_command% DEBUG}"
  eval "__dolphin_user_debug_trap=$__dolphin_debug_trap_command"
  unset __dolphin_chained_debug_trap
}
__dolphin_run_user_debug_trap() {
  if [[ -n "\${__dolphin_user_debug_trap:-}" ]]; then
    eval "$__dolphin_user_debug_trap" || true
  fi
}
__dolphin_adopt_outer_debug_trap() {
  local __dolphin_debug_trap_spec="\${__dolphin_outer_debug_trap_spec:-}"
  unset __dolphin_outer_debug_trap_spec
  __dolphin_update_user_debug_trap "$__dolphin_debug_trap_spec" "trap -- '__dolphin_osc133_preexec' DEBUG"
}
__dolphin_run_prompt_command_array() {
  local __dolphin_exit_code="\${__dolphin_prompt_status:-$?}" __dolphin_prompt_part __dolphin_prompt_index __dolphin_user_count
  local __dolphin_suffix_part
  local __dolphin_final_prompt_command
  local __dolphin_in_prompt_dispatch=1 __dolphin_dispatching_user_prompt_command=""
  unset __dolphin_prompt_status
  __dolphin_adopt_outer_debug_trap
  trap '__dolphin_osc133_preexec' DEBUG
  for __dolphin_prompt_part in "\${__dolphin_prompt_command_prefix[@]+"\${__dolphin_prompt_command_prefix[@]}"}"; do
    if (( __dolphin_exit_code == 0 )); then
      eval "$__dolphin_prompt_part"
    else
      __dolphin_restore_prompt_status "$__dolphin_exit_code" || eval "$__dolphin_prompt_part"
    fi
  done
  __dolphin_user_count=0
  for __dolphin_prompt_part in "\${__dolphin_prompt_command_array[@]+"\${__dolphin_prompt_command_array[@]}"}"; do
    __dolphin_user_count=$(( __dolphin_user_count + 1 ))
  done
  for (( __dolphin_prompt_index = 0; __dolphin_prompt_index + 1 < __dolphin_user_count; __dolphin_prompt_index++ )); do
    __dolphin_prompt_part="\${__dolphin_prompt_command_array[__dolphin_prompt_index]}"
    __dolphin_dispatching_user_prompt_command=1
    if (( __dolphin_exit_code == 0 )); then
      eval "$__dolphin_prompt_part"
    else
      __dolphin_restore_prompt_status "$__dolphin_exit_code" || eval "$__dolphin_prompt_part"
    fi
    __dolphin_dispatching_user_prompt_command=""
  done
  if (( __dolphin_user_count > 0 )); then
    __dolphin_prompt_part="\${__dolphin_prompt_command_array[__dolphin_user_count - 1]}"
    # Why: keep the final user hook and Dolphin suffixes in one status-preserving eval.
    __dolphin_final_prompt_command='eval "$__dolphin_prompt_part"'
    for __dolphin_suffix_part in "\${__dolphin_prompt_command_suffix[@]+"\${__dolphin_prompt_command_suffix[@]}"}"; do
      __dolphin_final_prompt_command+=$'\\n'"$__dolphin_suffix_part"
    done
    __dolphin_dispatching_user_prompt_command=1
    if (( __dolphin_exit_code == 0 )); then
      eval "$__dolphin_final_prompt_command"
    else
      __dolphin_restore_prompt_status "$__dolphin_exit_code" || eval "$__dolphin_final_prompt_command"
    fi
    __dolphin_dispatching_user_prompt_command=""
  else
    for __dolphin_prompt_part in "\${__dolphin_prompt_command_suffix[@]+"\${__dolphin_prompt_command_suffix[@]}"}"; do
      if (( __dolphin_exit_code == 0 )); then
        eval "$__dolphin_prompt_part"
      else
        __dolphin_restore_prompt_status "$__dolphin_exit_code" || eval "$__dolphin_prompt_part"
      fi
    done
  fi
  return "$__dolphin_exit_code"
}
__dolphin_finish_legacy_prompt_dispatch() {
  local __dolphin_suffix_part
  if [[ -n "\${__dolphin_in_prompt_command:-}" ]]; then
    for __dolphin_suffix_part in "\${__dolphin_prompt_command_suffix[@]+"\${__dolphin_prompt_command_suffix[@]}"}"; do
      eval "$__dolphin_suffix_part"
    done
  fi
  trap '__dolphin_osc133_preexec' DEBUG
  unset __dolphin_in_legacy_prompt_wrapper
}
__dolphin_normalize_prompt_command() {
  [[ -z "\${__dolphin_prompt_command_normalized:-}" ]] || return 0
  local __dolphin_prompt_part
  local -a __dolphin_normalized=()
  for __dolphin_prompt_part in "\${PROMPT_COMMAND[@]+"\${PROMPT_COMMAND[@]}"}"; do
    __dolphin_normalize_prompt_command_part "$__dolphin_prompt_part" __dolphin_prompt_part
    [[ -n "$__dolphin_prompt_part" ]] && __dolphin_normalized+=("$__dolphin_prompt_part")
  done
  __dolphin_prompt_command_normalized=1
  if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
    PROMPT_COMMAND=("\${__dolphin_normalized[@]+"\${__dolphin_normalized[@]}"}")
  else
    __dolphin_prompt_command_array=("\${__dolphin_normalized[@]+"\${__dolphin_normalized[@]}"}")
    __dolphin_prompt_command_prefix=()
    __dolphin_prompt_command_suffix=()
    unset PROMPT_COMMAND
    # Why: PID scope distinguishes legacy prompt dispatch from ordinary user command text.
    __dolphin_prompt_status_variable="__dolphin_prompt_status_$$"
    __dolphin_prompt_status_capture_command="$__dolphin_prompt_status_variable=\\$?"
    __dolphin_prompt_status_value="\\\${$__dolphin_prompt_status_variable}"
    PROMPT_COMMAND="$__dolphin_prompt_status_capture_command; __dolphin_prompt_status=$__dolphin_prompt_status_value"'; __dolphin_prompt_had_functrace=""; if [[ -o functrace ]]; then __dolphin_prompt_had_functrace=1; set +T; fi; __dolphin_outer_debug_trap_spec="$(trap -p DEBUG)"; [[ -z "$__dolphin_prompt_had_functrace" ]] || set -T; unset __dolphin_prompt_had_functrace; __dolphin_run_prompt_command_array; __dolphin_finish_legacy_prompt_dispatch'
  fi
}
__dolphin_prepend_prompt_command() {
  local command="$1"
  __dolphin_normalize_prompt_command
  if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
    PROMPT_COMMAND=("$command" "\${PROMPT_COMMAND[@]+"\${PROMPT_COMMAND[@]}"}")
  else
    __dolphin_prompt_command_prefix=("$command" "\${__dolphin_prompt_command_prefix[@]+"\${__dolphin_prompt_command_prefix[@]}"}")
  fi
}
__dolphin_append_prompt_command() {
  local command="$1"
  __dolphin_normalize_prompt_command
  if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
    PROMPT_COMMAND+=("$command")
  else
    __dolphin_prompt_command_suffix+=("$command")
  fi
}`
