// Why: the "host knows the API-key Claude agent" gate. An older host drops the unknown agent and
// runs plain `claude` on the host's own subscription login.
export const CLAUDE_API_AGENT_RUNTIME_CAPABILITY = 'agent.claude-api.v1' as const
export const CLAUDE_API_HOST_UPDATE_REQUIRED_MESSAGE =
  'The Claude API agent needs a newer Dolphin on this host. Update it and try again.'
// Why separate from v1: a host that knows `claude-api` but not its Agent Teams mode drops the
// unknown teams agent and runs plain `claude` on its subscription.
export const CLAUDE_API_AGENT_TEAMS_RUNTIME_CAPABILITY = 'agent.claude-api-agent-teams.v1' as const
export const CLAUDE_API_AGENT_TEAMS_HOST_UPDATE_REQUIRED_MESSAGE =
  'Claude Agent Teams (API key) needs a newer Dolphin on this host. Update it and try again.'
// Why: `claude-api` joined RESUMABLE_TUI_AGENTS after agent.claude-api.v1 shipped, so a host with
// only that gate still answers a claude-api ensureAgentSession with invalid_argument.
export const AGENT_SESSION_CLAUDE_API_RESUME_RUNTIME_CAPABILITY =
  'agent-session.claude-api-resume.v1' as const

/** Every capability a host advertises for the API-key agents. */
export const CLAUDE_API_RUNTIME_CAPABILITIES = [
  CLAUDE_API_AGENT_RUNTIME_CAPABILITY,
  CLAUDE_API_AGENT_TEAMS_RUNTIME_CAPABILITY,
  AGENT_SESSION_CLAUDE_API_RESUME_RUNTIME_CAPABILITY
] as const
