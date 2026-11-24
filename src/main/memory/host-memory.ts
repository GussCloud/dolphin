import { runProcess } from '../../shared/child-process/run-process'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { HostAvailableMemorySource, HostMemory } from '../../shared/process-stats-types'

const MEMORY_PRESSURE_TIMEOUT_MS = 1_000
const MEMORY_PRESSURE_MAX_BUFFER = 64 * 1024
const KIB = 1024
const AVAILABILITY_RETRY_AFTER_MS = 30_000

type AvailabilityReader = { supported: boolean; retryAtMs: number }

// Why: only a missing source is permanent; a timeout under load must not pin freemem until restart.
const darwinAvailability: AvailabilityReader = { supported: true, retryAtMs: 0 }
const linuxAvailability: AvailabilityReader = { supported: true, retryAtMs: 0 }

export async function collectHostMemory(): Promise<HostMemory> {
  const total = nonNegativeNumber(os.totalmem())
  const free = Math.min(total, nonNegativeNumber(os.freemem()))
  const preferred = await readAvailableMemory(os.platform(), total)
  const available = Math.min(total, Math.max(free, preferred?.bytes ?? free))
  const used = Math.max(0, total - available)

  return {
    totalMemory: total,
    freeMemory: free,
    availableMemory: available,
    availableMemorySource: preferred?.source ?? 'free-memory',
    usedMemory: used,
    memoryUsagePercent: total > 0 ? (used / total) * 100 : 0,
    cpuCoreCount: Math.max(1, os.cpus().length),
    loadAverage1m: nonNegativeNumber(os.loadavg()[0])
  }
}

export function fallbackHostMemory(): HostMemory {
  const total = nonNegativeNumber(os.totalmem())
  const free = Math.min(total, nonNegativeNumber(os.freemem()))
  const used = Math.max(0, total - free)
  return {
    totalMemory: total,
    freeMemory: free,
    availableMemory: free,
    availableMemorySource: 'free-memory',
    usedMemory: used,
    memoryUsagePercent: total > 0 ? (used / total) * 100 : 0,
    cpuCoreCount: Math.max(1, os.cpus().length),
    loadAverage1m: nonNegativeNumber(os.loadavg()[0])
  }
}

export function parseDarwinAvailableMemory(stdout: string, total: number): number | null {
  const match = /System-wide memory free percentage:\s*(\d+)%/.exec(stdout)
  const percentage = Number.parseInt(match?.[1] ?? '', 10)
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100 || total <= 0) {
    return null
  }
  return Math.round((total * percentage) / 100)
}

export function parseLinuxAvailableMemory(meminfo: string): number | null {
  const match = /^MemAvailable:\s*(\d+)\s+kB$/m.exec(meminfo)
  const kib = Number.parseInt(match?.[1] ?? '', 10)
  if (!Number.isSafeInteger(kib) || kib < 0 || kib > Number.MAX_SAFE_INTEGER / KIB) {
    return null
  }
  return kib * KIB
}

async function readAvailableMemory(
  platform: NodeJS.Platform,
  total: number
): Promise<{ bytes: number; source: HostAvailableMemorySource } | null> {
  if (platform === 'darwin') {
    const bytes = await readWithBackoff(darwinAvailability, () => readDarwinAvailableMemory(total))
    return bytes === null ? null : { bytes, source: 'memory-pressure' }
  }
  if (platform === 'linux') {
    const bytes = await readWithBackoff(linuxAvailability, readLinuxAvailableMemory)
    return bytes === null ? null : { bytes, source: 'proc-meminfo' }
  }
  return null
}

async function readWithBackoff(
  reader: AvailabilityReader,
  read: () => Promise<number | null>
): Promise<number | null> {
  if (!reader.supported || performance.now() < reader.retryAtMs) {
    return null
  }
  try {
    const bytes = await read()
    if (bytes !== null) {
      return bytes
    }
  } catch (error) {
    if (isMissingSourceError(error)) {
      reader.supported = false
      return null
    }
  }
  reader.retryAtMs = performance.now() + AVAILABILITY_RETRY_AFTER_MS
  return null
}

function isMissingSourceError(error: unknown): boolean {
  const code = error instanceof Error && 'code' in error ? error.code : undefined
  return code === 'ENOENT' || code === 'ENOTDIR'
}

async function readDarwinAvailableMemory(total: number): Promise<number | null> {
  const result = await runProcess({
    program: '/usr/bin/memory_pressure',
    args: ['-Q'],
    env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
    maxOutputBytes: MEMORY_PRESSURE_MAX_BUFFER,
    timeoutMs: MEMORY_PRESSURE_TIMEOUT_MS
  })
  if (result.code !== 0 || result.timedOut) {
    return null
  }
  return parseDarwinAvailableMemory(result.stdout, total)
}

async function readLinuxAvailableMemory(): Promise<number | null> {
  const meminfo = await readFile(path.join(path.sep, 'proc', 'meminfo'), 'utf8')
  return parseLinuxAvailableMemory(meminfo)
}

function nonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
}
