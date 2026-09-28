import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

const CLOUD_FLAGS = ['api-url']

export const ARTIFACT_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['artifacts', 'share'],
    summary: 'Share an HTML or Markdown file with your Dolphin account',
    usage: 'dolphin artifacts share <file> [--api-url <url>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, ...CLOUD_FLAGS, 'file'],
    positionalArgs: ['file'],
    examples: ['dolphin artifacts share ./report.html', 'dolphin artifacts share ./notes.md --json']
  },
  {
    path: ['artifacts', 'update'],
    summary: 'Update a file previously shared from this Dolphin profile',
    usage: 'dolphin artifacts update <file> [--api-url <url>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, ...CLOUD_FLAGS, 'file'],
    positionalArgs: ['file']
  },
  {
    path: ['artifacts', 'unshare'],
    destructive: true,
    summary: 'Delete the artifact associated with a previously shared file',
    usage: 'dolphin artifacts unshare <file> [--api-url <url>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, ...CLOUD_FLAGS, 'file'],
    positionalArgs: ['file']
  },
  {
    path: ['artifacts', 'list'],
    summary: 'List artifacts owned by the signed-in Dolphin account',
    usage: 'dolphin artifacts list [--cursor <cursor>] [--api-url <url>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, ...CLOUD_FLAGS, 'cursor']
  },
  {
    path: ['artifacts', 'delete'],
    aliases: [['artifacts', 'rm']],
    destructive: true,
    summary: 'Delete an artifact owned by the signed-in Dolphin account',
    usage: 'dolphin artifacts delete <id> [--api-url <url>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, ...CLOUD_FLAGS, 'id'],
    positionalArgs: ['id']
  }
]
