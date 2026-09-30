<h1 align="center">
  <img src="resources/build/icon.png" alt="Dolphin" width="64" valign="middle" /> Dolphin
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-08C?style=flat" alt="License: MIT" />
  <img src="https://img.shields.io/badge/Windows%20%7C%20Android-4493F8?style=flat-square" alt="Supported platforms: Windows and Android" />
</p>

<p align="center">
  <sub>English · <a href="docs/readme/README.pt.md">Português</a></sub>
</p>

<p align="center">
  <strong>Run coding agents side by side, each in its own worktree, tracked in one place.</strong><br/>
  Codex, Claude Code, OpenCode, Pi or any other terminal agent.
</p>

<h3 align="center"><a href="https://github.com/GussCloud/dolphin/releases/latest"><ins>Download Dolphin for Windows</ins></a></h3>

## Features

### Parallel Worktrees

Fan one prompt across several agents, each in its own isolated git worktree, then compare the results and merge the winner.

### Terminal Splits

GPU-rendered terminals with unlimited splits and scrollback that survives restarts.

### Design Mode

Click any element in a real Chromium window to send its HTML, CSS and a cropped screenshot into your agent's prompt.

### GitHub &amp; Linear

Browse PRs, issues and project boards in the app, and open a worktree from any task.

### SSH and WSL Worktrees

Run agents on a remote machine or inside WSL with full file editing, git and terminals.

### Annotate AI Diffs

Comment on any diff line and send it back to the agent, then review, edit and commit without leaving Dolphin.

### Dolphin CLI

Agents drive Dolphin too: script workflows with `dolphin worktree create`, `snapshot`, `click` and `fill`.

### Mobile Companion

Pair an Android phone with the desktop app to watch your agents and send follow-ups.

---

## Install

### Windows

Download `dolphin-windows-setup.exe` from the [latest release](https://github.com/GussCloud/dolphin/releases/latest). The installer is not code-signed yet, so Windows SmartScreen may ask you to confirm before running it. The app updates itself from the same releases.

### Android

There is no published APK yet. Build the companion app from source with the steps in [`mobile/README.md`](mobile/README.md) (`pnpm exec expo run:android`).

---

## Developing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for local setup and how releases are cut.

The relay that pairs the mobile app with a desktop host lives under [`cloud/`](cloud/README.md), with its own pnpm workspace and setup guide.

## License

Dolphin is free and open source under the [MIT License](LICENSE).
