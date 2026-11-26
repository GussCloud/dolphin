// Why: the "host knows the API-key Claude agent" gate. An older host drops the unknown agent and
// runs plain `claude` on the host's own subscription login.
export const CLAUDE_API_AGENT_RUNTIME_CAPABILITY = 'agent.claude-api.v1' as const
export const CLAUDE_API_HOST_UPDATE_REQUIRED_MESSAGE =
  'The Claude API agent needs a newer Dolphin on this host. Update it and try again.'
