#!/usr/bin/env node

// Release CI packages the x64 and arm64 mac slices on separate runners, and each writes a
// latest-mac.yml naming only its own zip and dmg. The updater reads ONE latest-mac.yml and picks
// its slice by "arm64" in the file name, so this joins the two into the manifest a two-slice
// electron-builder run writes.
//   merge-mac-update-manifests.mjs <x64 latest-mac.yml> <arm64 latest-mac.yml> <output>

import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { parse, stringify } from 'yaml'

const KNOWN_KEYS = new Set(['version', 'files', 'path', 'sha512', 'releaseDate'])
const SHA512_BASE64 = /^[A-Za-z0-9+/]{86}==$/

function readSlice(text, arch) {
  const manifest = parse(text)
  const fail = (message) => {
    throw new Error(`${arch} manifest: ${message}`)
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    fail('not a YAML mapping')
  }
  // Why strict: a key this merge does not know could be one the updater needs, and dropping it
  // would publish a manifest that differs from a two-slice run without anyone noticing.
  const unknown = Object.keys(manifest).filter((key) => !KNOWN_KEYS.has(key))
  if (unknown.length > 0) {
    fail(`unknown key(s) ${unknown.join(', ')}`)
  }
  if (typeof manifest.version !== 'string' || manifest.version === '') {
    fail('missing version')
  }
  if (Number.isNaN(Date.parse(manifest.releaseDate))) {
    fail('missing releaseDate')
  }
  const files = Array.isArray(manifest.files) ? manifest.files : []
  for (const file of files) {
    if (typeof file?.url !== 'string' || !SHA512_BASE64.test(file.sha512 ?? '')) {
      fail(`malformed file entry ${JSON.stringify(file)}`)
    }
    if (!Number.isInteger(file.size) || file.size <= 0) {
      fail(`${file.url} has no size`)
    }
    // Why: the updater tells the slices apart by this substring alone.
    if (file.url.includes('arm64') !== (arch === 'arm64')) {
      fail(`${file.url} belongs to the other slice`)
    }
  }
  const zips = files.filter((file) => file.url.endsWith('.zip'))
  const dmgs = files.filter((file) => file.url.endsWith('.dmg'))
  if (files.length !== 2 || zips.length !== 1 || dmgs.length !== 1) {
    fail(`expected one zip and one dmg, got ${files.map((file) => file.url).join(', ') || 'none'}`)
  }
  if (manifest.path !== zips[0].url || manifest.sha512 !== zips[0].sha512) {
    fail('path/sha512 do not name its zip')
  }
  return {
    version: manifest.version,
    releaseDate: manifest.releaseDate,
    zip: zips[0],
    dmg: dmgs[0]
  }
}

export function mergeMacUpdateManifests(x64Text, arm64Text) {
  const x64 = readSlice(x64Text, 'x64')
  const arm64 = readSlice(arm64Text, 'arm64')
  if (x64.version !== arm64.version) {
    throw new Error(`slices disagree on the version: x64 ${x64.version}, arm64 ${arm64.version}`)
  }
  const later = Date.parse(x64.releaseDate) > Date.parse(arm64.releaseDate) ? x64 : arm64
  // Order and top-level path/sha512 match what one two-slice electron-builder run writes.
  return {
    version: x64.version,
    files: [x64.zip, arm64.zip, x64.dmg, arm64.dmg],
    path: x64.zip.url,
    sha512: x64.zip.sha512,
    releaseDate: later.releaseDate
  }
}

// Why YAML 1.1: the updater parses with js-yaml, which turns an unquoted timestamp into a Date;
// 1.1 output quotes releaseDate, byte for byte what electron-builder writes.
export function serializeMacUpdateManifest(manifest) {
  return stringify(manifest, { lineWidth: 0, version: '1.1', singleQuote: true })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [x64Path, arm64Path, outputPath] = process.argv.slice(2)
    if (!x64Path || !arm64Path || !outputPath) {
      throw new Error('Usage: merge-mac-update-manifests.mjs <x64.yml> <arm64.yml> <output.yml>')
    }
    const merged = mergeMacUpdateManifests(
      readFileSync(x64Path, 'utf8'),
      readFileSync(arm64Path, 'utf8')
    )
    writeFileSync(outputPath, serializeMacUpdateManifest(merged))
    console.log(`Merged ${merged.files.map((file) => file.url).join(', ')} into ${outputPath}`)
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
