/** Leads PATH with the managed WSL CLI after startup files ran; an unusable CLI only warns. */
export const WSL_MANAGED_CLI_PATH_RESTORE = `if [ -n "\${DOLPHIN_WSL_CLI_DIR:-}" ]; then
  if [ -x "$DOLPHIN_WSL_CLI_DIR/\${DOLPHIN_CLI_COMMAND:-}" ]; then
    export PATH="$DOLPHIN_WSL_CLI_DIR\${PATH:+:$PATH}"
  else
    printf 'Dolphin CLI unavailable: cannot run %s. Check WSL Windows-drive mount options.\\n' "$DOLPHIN_WSL_CLI_DIR/\${DOLPHIN_CLI_COMMAND:-}" >&2
  fi
fi`
