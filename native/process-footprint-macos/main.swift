// Prints `pid footprintBytes` per line for every readable process (no args) or
// for the given pids, then exits.
//
// Why: `ps rss` excludes compressed, swapped and GPU memory on macOS, so it
// reads a fraction of what Activity Monitor's "Memory" column (physical
// footprint) shows. proc_pid_rusage only reads same-user processes, which is
// enough for Dolphin's own process tree; unreadable pids are skipped.
import Darwin

func footprint(of pid: pid_t) -> UInt64? {
  var info = rusage_info_v4()
  let rc = withUnsafeMutablePointer(to: &info) { pointer in
    pointer.withMemoryRebound(to: rusage_info_t?.self, capacity: 1) {
      proc_pid_rusage(pid, RUSAGE_INFO_V4, $0)
    }
  }
  return rc == 0 ? info.ri_phys_footprint : nil
}

func allPids() -> [pid_t] {
  let estimate = proc_listallpids(nil, 0)
  if estimate <= 0 {
    return []
  }
  // Why the slack: processes can start between the size probe and the read.
  var pids = [pid_t](repeating: 0, count: Int(estimate) + 64)
  let count = proc_listallpids(&pids, Int32(pids.count * MemoryLayout<pid_t>.size))
  if count <= 0 {
    return []
  }
  return Array(pids.prefix(Int(count)))
}

let arguments = CommandLine.arguments.dropFirst()
let targets = arguments.isEmpty ? allPids() : arguments.compactMap { pid_t($0) }
var output = ""
for pid in targets where pid > 0 {
  if let bytes = footprint(of: pid) {
    output += "\(pid) \(bytes)\n"
  }
}
fputs(output, stdout)
