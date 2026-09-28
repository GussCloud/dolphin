// Why: the pty IPC suites force darwin and rewrite a dozen agent-home env vars per test;
// this scope captures the real values once and puts them back afterwards.
export function createPtyIpcProcessEnvScope() {
  const savedOpenCodeConfigDir = process.env.OPENCODE_CONFIG_DIR
  const savedDolphinOpenCodeConfigDir = process.env.DOLPHIN_OPENCODE_CONFIG_DIR
  const savedDolphinOpenCodeSourceConfigDir = process.env.DOLPHIN_OPENCODE_SOURCE_CONFIG_DIR
  const savedPiAgentDir = process.env.PI_CODING_AGENT_DIR
  const savedDolphinPiAgentDir = process.env.DOLPHIN_PI_CODING_AGENT_DIR
  const savedDolphinPiSourceAgentDir = process.env.DOLPHIN_PI_SOURCE_AGENT_DIR
  const savedDolphinCodexHome = process.env.DOLPHIN_CODEX_HOME
  const savedDolphinOmpAgentDir = process.env.DOLPHIN_OMP_CODING_AGENT_DIR
  const savedDolphinOmpSourceAgentDir = process.env.DOLPHIN_OMP_SOURCE_AGENT_DIR
  const savedDolphinOmpStatusExtension = process.env.DOLPHIN_OMP_STATUS_EXTENSION
  const savedPrimeAgentDir = process.env.PRIME_AGENT_CODING_AGENT_DIR
  const savedDolphinPrimeAgentSourceDir = process.env.DOLPHIN_PRIME_AGENT_SOURCE_AGENT_DIR
  const savedDolphinPrimeAgentStatusExtension = process.env.DOLPHIN_PRIME_AGENT_STATUS_EXTENSION
  const savedDolphinClaudeAgentStatusSettings = process.env.DOLPHIN_CLAUDE_AGENT_STATUS_SETTINGS
  const savedProcessPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
  const savedDisableMacosLoginShell = process.env.DOLPHIN_DISABLE_MACOS_LOGIN_SHELL
  const savedDolphinUserDataPath = process.env.DOLPHIN_USER_DATA_PATH

  function applyTestEnvDefaults() {
    // Why: most PTY spawn tests assert POSIX shell behavior; Windows cases opt into win32 explicitly below.
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: 'darwin'
    })
    // Why: forced darwin makes the TCC login(1) wrapper rewrite every asserted argv; its own test below re-enables it.
    process.env.DOLPHIN_DISABLE_MACOS_LOGIN_SHELL = '1'
    delete process.env.OPENCODE_CONFIG_DIR
    delete process.env.DOLPHIN_OPENCODE_SOURCE_CONFIG_DIR
    delete process.env.DOLPHIN_OPENCODE_CONFIG_DIR
    delete process.env.DOLPHIN_AGENT_HOOK_ENDPOINT
    delete process.env.DOLPHIN_CLAUDE_AGENT_STATUS_SETTINGS
    delete process.env.PI_CODING_AGENT_DIR
    delete process.env.DOLPHIN_PI_SOURCE_AGENT_DIR
    delete process.env.DOLPHIN_PI_CODING_AGENT_DIR
    delete process.env.DOLPHIN_CODEX_HOME
    delete process.env.DOLPHIN_OMP_SOURCE_AGENT_DIR
    delete process.env.DOLPHIN_OMP_CODING_AGENT_DIR
    delete process.env.DOLPHIN_OMP_STATUS_EXTENSION
    delete process.env.PRIME_AGENT_CODING_AGENT_DIR
    delete process.env.DOLPHIN_PRIME_AGENT_SOURCE_AGENT_DIR
    delete process.env.DOLPHIN_PRIME_AGENT_STATUS_EXTENSION
  }

  function restoreProcessEnv() {
    if (savedProcessPlatform) {
      Object.defineProperty(process, 'platform', savedProcessPlatform)
    }
    if (savedDisableMacosLoginShell !== undefined) {
      process.env.DOLPHIN_DISABLE_MACOS_LOGIN_SHELL = savedDisableMacosLoginShell
    } else {
      delete process.env.DOLPHIN_DISABLE_MACOS_LOGIN_SHELL
    }
    if (savedDolphinUserDataPath !== undefined) {
      process.env.DOLPHIN_USER_DATA_PATH = savedDolphinUserDataPath
    } else {
      delete process.env.DOLPHIN_USER_DATA_PATH
    }
    if (savedOpenCodeConfigDir !== undefined) {
      process.env.OPENCODE_CONFIG_DIR = savedOpenCodeConfigDir
    } else {
      delete process.env.OPENCODE_CONFIG_DIR
    }
    if (savedDolphinOpenCodeConfigDir !== undefined) {
      process.env.DOLPHIN_OPENCODE_CONFIG_DIR = savedDolphinOpenCodeConfigDir
    } else {
      delete process.env.DOLPHIN_OPENCODE_CONFIG_DIR
    }
    if (savedDolphinOpenCodeSourceConfigDir !== undefined) {
      process.env.DOLPHIN_OPENCODE_SOURCE_CONFIG_DIR = savedDolphinOpenCodeSourceConfigDir
    } else {
      delete process.env.DOLPHIN_OPENCODE_SOURCE_CONFIG_DIR
    }
    if (savedPiAgentDir !== undefined) {
      process.env.PI_CODING_AGENT_DIR = savedPiAgentDir
    } else {
      delete process.env.PI_CODING_AGENT_DIR
    }
    if (savedDolphinPiAgentDir !== undefined) {
      process.env.DOLPHIN_PI_CODING_AGENT_DIR = savedDolphinPiAgentDir
    } else {
      delete process.env.DOLPHIN_PI_CODING_AGENT_DIR
    }
    if (savedDolphinPiSourceAgentDir === undefined) {
      delete process.env.DOLPHIN_PI_SOURCE_AGENT_DIR
    } else {
      process.env.DOLPHIN_PI_SOURCE_AGENT_DIR = savedDolphinPiSourceAgentDir
    }
    if (savedDolphinCodexHome === undefined) {
      delete process.env.DOLPHIN_CODEX_HOME
    } else {
      process.env.DOLPHIN_CODEX_HOME = savedDolphinCodexHome
    }
    if (savedDolphinOmpAgentDir !== undefined) {
      process.env.DOLPHIN_OMP_CODING_AGENT_DIR = savedDolphinOmpAgentDir
    } else {
      delete process.env.DOLPHIN_OMP_CODING_AGENT_DIR
    }
    if (savedDolphinOmpSourceAgentDir !== undefined) {
      process.env.DOLPHIN_OMP_SOURCE_AGENT_DIR = savedDolphinOmpSourceAgentDir
    } else {
      delete process.env.DOLPHIN_OMP_SOURCE_AGENT_DIR
    }
    if (savedDolphinOmpStatusExtension !== undefined) {
      process.env.DOLPHIN_OMP_STATUS_EXTENSION = savedDolphinOmpStatusExtension
    } else {
      delete process.env.DOLPHIN_OMP_STATUS_EXTENSION
    }
    if (savedPrimeAgentDir !== undefined) {
      process.env.PRIME_AGENT_CODING_AGENT_DIR = savedPrimeAgentDir
    } else {
      delete process.env.PRIME_AGENT_CODING_AGENT_DIR
    }
    if (savedDolphinPrimeAgentSourceDir !== undefined) {
      process.env.DOLPHIN_PRIME_AGENT_SOURCE_AGENT_DIR = savedDolphinPrimeAgentSourceDir
    } else {
      delete process.env.DOLPHIN_PRIME_AGENT_SOURCE_AGENT_DIR
    }
    if (savedDolphinPrimeAgentStatusExtension !== undefined) {
      process.env.DOLPHIN_PRIME_AGENT_STATUS_EXTENSION = savedDolphinPrimeAgentStatusExtension
    } else {
      delete process.env.DOLPHIN_PRIME_AGENT_STATUS_EXTENSION
    }
    if (savedDolphinClaudeAgentStatusSettings === undefined) {
      delete process.env.DOLPHIN_CLAUDE_AGENT_STATUS_SETTINGS
    } else {
      process.env.DOLPHIN_CLAUDE_AGENT_STATUS_SETTINGS = savedDolphinClaudeAgentStatusSettings
    }
  }

  return { applyTestEnvDefaults, restoreProcessEnv }
}
