export type SupportedAgent = {
  name: string
  // Omitted when the repo ships no bundled icon for the agent.
  icon?: string
}

export const SUPPORTED_AGENTS: SupportedAgent[] = [
  { name: 'Claude Code', icon: '/agents/claude.svg' },
  { name: 'Codex' },
  { name: 'Grok', icon: '/agents/grok.png' },
  { name: 'Gemini', icon: '/agents/gemini.png' },
  { name: 'Cursor', icon: '/agents/cursor.png' },
  { name: 'GitHub Copilot', icon: '/agents/copilot.png' },
  { name: 'OpenCode', icon: '/agents/opencode.png' },
  { name: 'Amp', icon: '/agents/amp.png' },
  { name: 'OpenClaude', icon: '/agents/openclaude.png' },
  { name: 'Antigravity', icon: '/agents/antigravity.png' },
  { name: 'Pi' },
  { name: 'Hermes Agent', icon: '/agents/hermes.png' },
  { name: 'Goose', icon: '/agents/goose.png' },
  { name: 'Auggie', icon: '/agents/aug.png' },
  { name: 'Crush', icon: '/agents/crush.png' },
  { name: 'Cline', icon: '/agents/cline.png' },
  { name: 'Codebuff', icon: '/agents/codebuff.png' },
  { name: 'Command Code', icon: '/agents/command-code.png' },
  { name: 'Continue', icon: '/agents/continue.png' },
  { name: 'Droid', icon: '/agents/droid.png' },
  { name: 'Kilocode', icon: '/agents/kilo.png' },
  { name: 'Kimi', icon: '/agents/kimi.png' },
  { name: 'Kiro', icon: '/agents/kiro.png' },
  { name: 'Mistral Vibe', icon: '/agents/mistral-vibe.png' },
  { name: 'Qwen Code', icon: '/agents/qwen-code.png' },
  { name: 'Rovo Dev', icon: '/agents/rovo.png' },
  { name: 'Devin', icon: '/agents/devin.png' },
  { name: 'Trae', icon: '/agents/trae.png' }
]
