export type FrequentlyAskedQuestion = {
  question: string
  answer: string
}

export const FREQUENTLY_ASKED_QUESTIONS: FrequentlyAskedQuestion[] = [
  {
    question: 'What is Dolphin?',
    answer:
      'Dolphin is a multi-agent dev orchestrator: a desktop app for running coding agents like Claude Code, Codex, and OpenCode side by side, each in its own git worktree, with terminals, diffs, a browser, and a CLI in one place.'
  },
  {
    question: 'How is an ADE different from an IDE?',
    answer:
      'An IDE is built around one person typing in one checkout. An agent development environment is built around many agents working at once: isolated worktrees, live agent status, review tools that send feedback back to the agent, and a CLI the agents can drive themselves.'
  },
  {
    question: 'How do worktrees work in Dolphin?',
    answer:
      'Each task gets its own git worktree on its own branch, so agents never overwrite each other. Create one from a prompt, a GitHub issue, or a Linear ticket, compare the results, and merge the one you want. Plain folders work too when a project is not a git repository.'
  },
  {
    question: 'Which agents does it support?',
    answer:
      'Claude Code, Codex, Gemini, Cursor CLI, GitHub Copilot, OpenCode, Pi, Grok, and many more come preconfigured. Any other agent that runs in a terminal works as well.'
  },
  {
    question: 'What is the terminal like?',
    answer:
      'GPU-rendered terminals with unlimited splits, scrollback that survives restarts, and full scrollback search. On Windows you can pick PowerShell, Command Prompt, Git Bash, or a WSL distro per terminal.'
  },
  {
    question: 'Which platforms does it run on?',
    answer:
      'Dolphin ships a Windows installer on GitHub Releases, and the app updates itself from the same releases. The Android companion app is built from source for now; see the mobile guide in the repository.'
  },
  {
    question: 'Can I run agents on a remote machine?',
    answer:
      'Yes. Connect a worktree over SSH, or run it inside WSL, and you get full file editing, git, and terminals on that host, with auto-reconnect and port forwarding.'
  },
  {
    question: 'Is Dolphin a Cursor alternative?',
    answer:
      'Dolphin is not an editor with an assistant bolted on. It is the environment around your agents, and it can run Cursor CLI alongside every other agent you already use.'
  },
  {
    question: 'Is it free?',
    answer:
      'Yes. Dolphin is free and open source under the MIT license. You bring your own agent subscriptions.'
  }
]
