/**
 * Line-preserving `.wslconfig` editor: comments, unknown keys, ordering and line
 * endings survive, so applying a suggestion only touches the lines it names.
 */
export type WslConfigDocument = {
  lines: string[]
  eol: '\r\n' | '\n'
}

const SECTION_PATTERN = /^\s*\[([^\]]+)\]\s*(?:[#;].*)?$/
const KEY_PATTERN = /^\s*([A-Za-z0-9_.]+)\s*=(.*)$/

export function parseWslConfigDocument(text: string): WslConfigDocument {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.length === 0 ? [] : text.split(/\r?\n/)
  if (lines.length > 0 && lines.at(-1) === '') {
    lines.pop()
  }
  return { lines, eol }
}

export function serializeWslConfigDocument(document: WslConfigDocument): string {
  return document.lines.length === 0 ? '' : `${document.lines.join(document.eol)}${document.eol}`
}

function sectionNameAt(line: string): string | null {
  const match = SECTION_PATTERN.exec(line)
  return match ? match[1].trim().toLowerCase() : null
}

function keyLineValue(line: string, key: string): string | null {
  const match = KEY_PATTERN.exec(line)
  if (!match || match[1].toLowerCase() !== key.toLowerCase()) {
    return null
  }
  // Why: WSL treats `#` as a comment start; a trailing comment is not part of the value.
  return match[2].replace(/\s[#;].*$/, '').trim()
}

type KeyLocation = { sectionEnd: number; keyLine: number | null } | null

function locateKey(document: WslConfigDocument, section: string, key: string): KeyLocation {
  const wanted = section.toLowerCase()
  let inSection = false
  let lastContentLine = -1
  let keyLine: number | null = null
  let found = false
  for (let index = 0; index < document.lines.length; index += 1) {
    const line = document.lines[index]
    const name = sectionNameAt(line)
    if (name !== null) {
      if (inSection) {
        break
      }
      inSection = name === wanted
      if (inSection) {
        found = true
        lastContentLine = index
      }
      continue
    }
    if (!inSection) {
      continue
    }
    if (line.trim() !== '') {
      lastContentLine = index
    }
    // Why: WSL reads the last duplicate, so edit that one.
    if (keyLineValue(line, key) !== null) {
      keyLine = index
    }
  }
  return found ? { sectionEnd: lastContentLine, keyLine } : null
}

export function readWslConfigValue(
  document: WslConfigDocument,
  section: string,
  key: string
): string | null {
  const location = locateKey(document, section, key)
  if (!location || location.keyLine === null) {
    return null
  }
  return keyLineValue(document.lines[location.keyLine], key)
}

export function setWslConfigValue(
  document: WslConfigDocument,
  section: string,
  key: string,
  value: string
): WslConfigDocument {
  const lines = [...document.lines]
  const entry = `${key}=${value}`
  const location = locateKey(document, section, key)
  if (location && location.keyLine !== null) {
    lines[location.keyLine] = entry
  } else if (location) {
    lines.splice(location.sectionEnd + 1, 0, entry)
  } else {
    if (lines.length > 0 && lines.at(-1)?.trim() !== '') {
      lines.push('')
    }
    lines.push(`[${section}]`, entry)
  }
  return { ...document, lines }
}
