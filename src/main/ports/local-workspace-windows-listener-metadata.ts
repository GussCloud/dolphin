import {
  isWindowsProcessStartTimeAvailable,
  readWindowsProcessCreationTime,
  readWindowsProcessTable
} from '../windows/windows-process-table'
import {
  partitionListenersNeedingMetadata,
  type ProcessMetadata,
  type RawListeningPort,
  type WorkspacePortScanOptions
} from './local-workspace-port-scan-state'

export function partitionWindowsListenersNeedingMetadata(
  ports: RawListeningPort[],
  options: WorkspacePortScanOptions
): ReturnType<typeof partitionListenersNeedingMetadata> {
  // Without start times a recycled pid is indistinguishable, so every scan probes as before.
  if (!isWindowsProcessStartTimeAvailable()) {
    return partitionListenersNeedingMetadata(ports, { ...options, requireMetadata: true })
  }
  const identityByPid = new Map<number, string>()
  const identified = ports.map((port) => {
    if (port.pid === undefined) {
      return port
    }
    let identity = identityByPid.get(port.pid)
    if (identity === undefined) {
      const startedAtMs = readWindowsProcessCreationTime(port.pid)
      // Why trust pid alone for 'unopenable': only protected/system services deny the handle,
      // and they are long-lived; a switch to or from an openable process still re-probes.
      identity = startedAtMs === null ? 'unopenable' : `started:${startedAtMs}`
      identityByPid.set(port.pid, identity)
    }
    return { ...port, socketId: identity }
  })
  return partitionListenersNeedingMetadata(identified, options, { processNameFromMetadata: true })
}

export async function loadWindowsProcessMetadata(
  pids: Set<number>
): Promise<Map<number, ProcessMetadata>> {
  const result = new Map<number, ProcessMetadata>()
  if (pids.size === 0) {
    return result
  }
  try {
    // Why the native snapshot: attributing ports used to fork a powershell.exe
    // per scan just to turn PIDs into names. That is a ~700ms cold start, a
    // conhost window, and one more thing a Group Policy can block -- for data
    // the panel treats as optional anyway.
    for (const row of await readWindowsProcessTable()) {
      if (pids.has(row.pid)) {
        // Why '' is kept: it marks a probed process whose command line is unreadable, so the
        // metadata cache keeps that answer instead of re-reading the table every scan.
        result.set(row.pid, { processName: row.name, commandLine: row.command })
      }
    }
  } catch {
    // Process metadata is optional; port rows still render without attribution.
  }
  return result
}
