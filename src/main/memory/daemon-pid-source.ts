// Why a registered reader: the collector must not import the daemon provider graph (heavy, and
// Electron-bound in tests); whoever owns the daemon wires its pid in once.
let readDaemonPid: (() => number | null) | null = null

export function setMemorySnapshotDaemonPidReader(reader: (() => number | null) | null): void {
  readDaemonPid = reader
}

export function readMemorySnapshotDaemonPid(): number | null {
  try {
    const pid = readDaemonPid?.() ?? null
    return typeof pid === 'number' && Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}
