<h1 align="center">
  <a href="https://dolphin.guss.dev.br"><img src="resources/build/icon.png" alt="Dolphin" width="64" valign="middle" /></a> Dolphin
</h1>

<p align="center">
  <a href="https://github.com/GussCloud/dolphin"><img src="https://img.shields.io/github/stars/GussCloud/dolphin?style=flat&amp;label=%E2%98%85&amp;color=08C" alt="GitHub stars" /></a>
  <a href="https://github.com/GussCloud/dolphin/releases"><img src="docs/assets/readme-downloads.svg" alt="Total downloads across all releases" /></a>
  <img src="https://img.shields.io/badge/license-MIT-08C?style=flat" alt="License: MIT" />
  <a href="https://discord.gg/fzjDKHxv8Q"><img src="https://img.shields.io/badge/Discord-5865F2?logo=discord&logoColor=white" alt="Join the Dolphin Discord" /></a>
  <a href="https://x.com/dolphin_build"><img src="https://img.shields.io/badge/X-000000?logo=x&logoColor=white" alt="Follow Dolphin on X" /></a>
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows%20%7C%20Linux-4493F8?style=flat-square" alt="Supported platforms: macOS, Windows, and Linux" />
</p>

<p align="center">
  <sub><a href="docs/readme/README.zh-CN.md">中文</a> · <a href="docs/readme/README.ja.md">日本語</a> · <a href="docs/readme/README.ko.md">한국어</a> · <a href="docs/readme/README.es.md">Español</a> · <a href="docs/readme/README.fr.md">Français</a> · <a href="docs/readme/README.pt.md">Português</a></sub>
</p>

<p align="center">
  <strong>The AI Orchestrator for 100x builders.</strong><br/>
  Run Codex, ClaudeCode, OpenCode or Pi side-by-side — each in its own worktree, tracked in one place.
</p>

<h3 align="center"><a href="https://dolphin.guss.dev.br/download"><ins>Download Dolphin</ins></a></h3>

<p align="center">
  <img src="docs/assets/readme-hero.jpg" alt="Dolphin desktop app running agents in parallel worktrees, with the Dolphin mobile companion app in the corner" width="960" />
</p>

## Features

<table>
<tr>
<td width="50%" valign="middle">

### Mobile Companion

Monitor and steer your agents from your phone — get notified when an agent finishes and send follow-ups from anywhere.

[iOS App Store](https://apps.apple.com/us/app/dolphin-ide/id6766130217) · [TestFlight](https://testflight.apple.com/join/YjeGMQBA) · [Android APK 0.0.50](https://github.com/GussCloud/dolphin/releases/download/mobile-android-v0.0.50/app-release.apk) · [Docs →](https://dolphin.guss.dev.br/docs/mobile)

</td>
<td width="50%">
  <a href="https://dolphin.guss.dev.br/docs/mobile"><picture><source srcset="docs/assets/feature-wall/mobile-companion-app-showcase.gif" type="image/gif"><img src="docs/assets/feature-wall/mobile-companion-app-showcase.jpg" alt="Dolphin desktop with the mobile companion app" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Parallel Worktrees

Fan one prompt across five agents, each in its own isolated git worktree — compare the results and merge the winner.

[Docs →](https://dolphin.guss.dev.br/docs/model/worktrees)

</td>
<td width="50%">
  <a href="https://dolphin.guss.dev.br/docs/model/worktrees"><picture><source srcset="docs/site/public/docs/tab-split.gif" type="image/gif"><img src="docs/site/public/docs/posters/tab-split.jpg" alt="Parallel worktree orchestration" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Terminal Splits

Ghostty-class terminals with WebGL rendering, infinite splits, and scrollback that survives restarts.

[Docs →](https://dolphin.guss.dev.br/docs/terminal)

</td>
<td width="50%">
  <a href="https://dolphin.guss.dev.br/docs/terminal"><picture><source srcset="resources/onboarding/feature-wall/tile-02.gif" type="image/gif"><img src="resources/onboarding/feature-wall/tile-02.poster.jpg" alt="Terminal splits" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Design Mode

Click any UI element in a real Chromium window to send its HTML, CSS, and a cropped screenshot straight into your agent's prompt.

[Docs →](https://dolphin.guss.dev.br/docs/browser/design-mode)

</td>
<td width="50%">
  <a href="https://dolphin.guss.dev.br/docs/browser/design-mode"><picture><source srcset="docs/site/public/docs/dolphin-design-mode.gif" type="image/gif"><img src="resources/onboarding/feature-wall/tile-05.poster.jpg" alt="Embedded browser and Design Mode" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### GitHub &amp; Linear, Native

Browse PRs, issues, and project boards in-app — open a worktree from any task and review without a context switch.

[Docs →](https://dolphin.guss.dev.br/docs/review/linear)

</td>
<td width="50%">
  <a href="https://dolphin.guss.dev.br/docs/review/linear"><picture><source srcset="resources/onboarding/feature-wall/tile-03.gif" type="image/gif"><img src="resources/onboarding/feature-wall/tile-03.poster.jpg" alt="GitHub and Linear task workflows in Dolphin" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### SSH Worktrees

Run agents on a beefy remote box with full file editing, git, and terminals — auto-reconnect and port forwarding included.

[Docs →](https://dolphin.guss.dev.br/docs/ssh)

</td>
<td width="50%">
  <a href="https://dolphin.guss.dev.br/docs/ssh"><picture><source srcset="resources/onboarding/feature-wall/tile-06.gif" type="image/gif"><img src="resources/onboarding/feature-wall/tile-06.poster.jpg" alt="Remote worktrees over SSH" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Annotate AI Diffs

Drop comments on any diff line and ship them back to the agent — review, edit, and commit without leaving Dolphin.

[Docs →](https://dolphin.guss.dev.br/docs/review/annotate-ai-diff)

</td>
<td width="50%">
  <a href="https://dolphin.guss.dev.br/docs/review/annotate-ai-diff"><picture><source srcset="docs/site/public/docs/annotate-ai-diff.gif" type="image/gif"><img src="resources/onboarding/feature-wall/tile-08.poster.jpg" alt="Annotate AI-generated diffs" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Drag Files to Agents

VS Code's editor with autosave everywhere — drag files or images straight into an agent prompt.

[Docs →](https://dolphin.guss.dev.br/docs/editing/file-explorer)

</td>
<td width="50%">
  <a href="https://dolphin.guss.dev.br/docs/editing/file-explorer"><picture><source srcset="resources/onboarding/feature-wall/tile-07.gif" type="image/gif"><img src="resources/onboarding/feature-wall/tile-07.poster.jpg" alt="Drag files and images into an agent prompt" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Dolphin CLI

Agents drive Dolphin too — script every workflow with `dolphin worktree create`, `snapshot`, `click`, and `fill`.

[Docs →](https://dolphin.guss.dev.br/docs/cli/overview)

</td>
<td width="50%">
  <a href="https://dolphin.guss.dev.br/docs/cli/overview"><picture><source srcset="resources/onboarding/feature-wall/tile-09.gif" type="image/gif"><img src="resources/onboarding/feature-wall/tile-09.poster.jpg" alt="Script Dolphin from the CLI" width="100%" /></picture></a>
</td>
</tr>
</table>

**Also in the box:**

- **[Quick open](https://dolphin.guss.dev.br/docs/model/quick-open)** — Search across worktrees, files, agents, commands, and repo context without leaving your flow.
- **[Account switcher &amp; usage tracking](https://dolphin.guss.dev.br/docs/agents/usage-tracking)** — See Claude and Codex usage and rate-limit resets, and hot-swap accounts without re-logging in.
- **[Rich repo previews](https://dolphin.guss.dev.br/docs/editing/markdown)** — Preview Markdown, images, PDFs, and repo docs in the workspace.
- **[Computer Use](https://dolphin.guss.dev.br/docs/cli/computer-use)** — Let agents operate desktop apps and visible UI when a workflow needs real interaction.
- **[Notifications and unread state](https://dolphin.guss.dev.br/docs/notifications)** — Know when an agent finishes or needs attention, then mark threads unread to come back later.
- **And many, many more** — we ship daily, so this list is perpetually behind. The [changelog](https://github.com/GussCloud/dolphin/releases) is the real feature list.

---

## Supported Agents

Works with **any CLI agent** — if it runs in a terminal, it runs in Dolphin.

<p>
  <a href="https://docs.anthropic.com/claude/docs/claude-code"><kbd><img src="docs/assets/claude-logo.svg" alt="Claude Code logo" width="16" valign="middle" /> Claude Code</kbd></a> &nbsp;
  <a href="https://github.com/openai/codex"><kbd><img src="https://www.google.com/s2/favicons?domain=openai.com&sz=64" alt="Codex logo" width="16" valign="middle" /> Codex</kbd></a> &nbsp;
  <a href="https://x.ai/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=x.ai&sz=64" alt="Grok logo" width="16" valign="middle" /> Grok</kbd></a> &nbsp;
  <a href="https://cursor.com/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=cursor.com&sz=64" alt="Cursor logo" width="16" valign="middle" /> Cursor</kbd></a> &nbsp;
  <a href="https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli"><kbd><img src="https://www.google.com/s2/favicons?domain=github.com&sz=64" alt="GitHub Copilot logo" width="16" valign="middle" /> GitHub Copilot</kbd></a> &nbsp;
  <a href="https://dev.meta.ai/docs/muse-code"><kbd><img src="src/shared/agent-icons/muse.png" alt="Muse logo" width="16" valign="middle" /> Muse</kbd></a> &nbsp;
  <a href="https://zcode.z.ai/en/docs"><kbd><img src="src/shared/agent-icons/zcode.png" alt="ZCode logo" width="16" valign="middle" /> ZCode</kbd></a> &nbsp;
  <a href="https://opencode.ai/docs/cli/"><kbd><img src="https://www.google.com/s2/favicons?domain=opencode.ai&sz=64" alt="OpenCode logo" width="16" valign="middle" /> OpenCode</kbd></a> &nbsp;
  <a href="https://mimo.xiaomi.com/coder"><kbd><img src="https://www.google.com/s2/favicons?domain=mimo.xiaomi.com&sz=64" alt="MiMo Code logo" width="16" valign="middle" /> MiMo Code</kbd></a> &nbsp;
  <a href="https://ampcode.com/manual#install"><kbd><img src="https://www.google.com/s2/favicons?domain=ampcode.com&sz=64" alt="Amp logo" width="16" valign="middle" /> Amp</kbd></a> &nbsp;
  <a href="https://openclaude.gitlawb.com/"><kbd><img src="resources/openclaude-logo.png" alt="OpenClaude logo" width="16" valign="middle" /> OpenClaude</kbd></a> &nbsp;
  <a href="https://antigravity.google/docs/cli-overview"><kbd><img src="https://www.google.com/s2/favicons?domain=antigravity.google&sz=64" alt="Antigravity logo" width="16" valign="middle" /> Antigravity</kbd></a> &nbsp;
  <a href="https://pi.dev"><kbd><img src="https://pi.dev/favicon.svg" alt="Pi logo" width="16" valign="middle" /> Pi</kbd></a> &nbsp;
  <a href="https://omp.sh"><kbd><img src="https://omp.sh/favicon.svg" alt="oh-my-pi logo" width="16" valign="middle" /> oh-my-pi</kbd></a> &nbsp;
  <a href="https://hermes-agent.nousresearch.com/docs/"><kbd><img src="https://www.google.com/s2/favicons?domain=nousresearch.com&sz=64" alt="Hermes Agent logo" width="16" valign="middle" /> Hermes Agent</kbd></a> &nbsp;
  <a href="https://devin.ai/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=devin.ai&sz=64" alt="Devin logo" width="16" valign="middle" /> Devin</kbd></a> &nbsp;
  <a href="https://block.github.io/goose/docs/quickstart/"><kbd><img src="https://www.google.com/s2/favicons?domain=goose-docs.ai&sz=64" alt="Goose logo" width="16" valign="middle" /> Goose</kbd></a> &nbsp;
  <a href="https://docs.augmentcode.com/cli/overview"><kbd><img src="https://www.google.com/s2/favicons?domain=augmentcode.com&sz=64" alt="Auggie logo" width="16" valign="middle" /> Auggie</kbd></a> &nbsp;
  <a href="https://github.com/autohandai/code-cli"><kbd><img src="https://www.google.com/s2/favicons?domain=autohand.ai&sz=64" alt="Autohand Code logo" width="16" valign="middle" /> Autohand Code</kbd></a> &nbsp;
  <a href="https://github.com/charmbracelet/crush"><kbd><img src="https://www.google.com/s2/favicons?domain=charm.sh&sz=64" alt="Charm logo" width="16" valign="middle" /> Charm</kbd></a> &nbsp;
  <a href="https://docs.cline.bot/cline-cli/overview"><kbd><img src="https://www.google.com/s2/favicons?domain=cline.bot&sz=64" alt="Cline logo" width="16" valign="middle" /> Cline</kbd></a> &nbsp;
  <a href="https://www.codebuff.com/docs/help/quick-start"><kbd><img src="https://www.google.com/s2/favicons?domain=codebuff.com&sz=64" alt="Codebuff logo" width="16" valign="middle" /> Codebuff</kbd></a> &nbsp;
  <a href="https://commandcode.ai/docs/quickstart"><kbd><img src="https://www.google.com/s2/favicons?domain=commandcode.ai&sz=64" alt="Command Code logo" width="16" valign="middle" /> Command Code</kbd></a> &nbsp;
  <a href="https://docs.continue.dev/guides/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=continue.dev&sz=64" alt="Continue logo" width="16" valign="middle" /> Continue</kbd></a> &nbsp;
  <a href="https://docs.factory.ai/cli/getting-started/quickstart"><kbd><img src="docs/assets/droid-logo.svg" alt="Droid logo" width="16" valign="middle" /> Droid</kbd></a> &nbsp;
  <a href="https://kilo.ai/docs/cli"><kbd><img src="https://raw.githubusercontent.com/Kilo-Org/kilocode/main/packages/kilo-vscode/assets/icons/kilo-light.svg" alt="Kilocode logo" width="16" valign="middle" /> Kilocode</kbd></a> &nbsp;
  <a href="https://www.kimi.com/code/docs/en/kimi-code-cli/getting-started.html"><kbd><img src="https://www.google.com/s2/favicons?domain=moonshot.cn&sz=64" alt="Kimi logo" width="16" valign="middle" /> Kimi</kbd></a> &nbsp;
  <a href="https://kiro.dev/docs/cli/"><kbd><img src="https://www.google.com/s2/favicons?domain=kiro.dev&sz=64" alt="Kiro logo" width="16" valign="middle" /> Kiro</kbd></a> &nbsp;
  <a href="https://github.com/mistralai/mistral-vibe"><kbd><img src="https://www.google.com/s2/favicons?domain=mistral.ai&sz=64" alt="Mistral Vibe logo" width="16" valign="middle" /> Mistral Vibe</kbd></a> &nbsp;
  <a href="https://github.com/QwenLM/qwen-code"><kbd><img src="https://www.google.com/s2/favicons?domain=qwenlm.github.io&sz=64" alt="Qwen Code logo" width="16" valign="middle" /> Qwen Code</kbd></a> &nbsp;
  <a href="https://support.atlassian.com/rovo/docs/install-and-run-rovo-dev-cli-on-your-device/"><kbd><img src="https://www.google.com/s2/favicons?domain=atlassian.com&sz=64" alt="Rovo Dev logo" width="16" valign="middle" /> Rovo Dev</kbd></a> &nbsp;
  <kbd>+ any CLI agent</kbd>
</p>

---

## Install

### Desktop — macOS, Windows, Linux

- **[Download from dolphin.guss.dev.br](https://dolphin.guss.dev.br/download)**
- Or grab a build directly: [macOS Apple Silicon](https://github.com/GussCloud/dolphin/releases/latest/download/dolphin-macos-arm64.dmg) · [macOS Intel](https://github.com/GussCloud/dolphin/releases/latest/download/dolphin-macos-x64.dmg) · [Windows (.exe)](https://github.com/GussCloud/dolphin/releases/latest/download/dolphin-windows-setup.exe) · [Linux AppImage](https://github.com/GussCloud/dolphin/releases/latest/download/dolphin-linux.AppImage) · [All builds](https://github.com/GussCloud/dolphin/releases/latest)
- Running `dolphin serve` on a headless Linux server? See the [headless Linux server guide](docs/reference/headless-linux-server.md).

_Or via a package manager:_

```bash
# macOS (Homebrew)
brew install --cask GussCloud/dolphin/dolphin

# Arch Linux (AUR) — or gusscloud-dolphin-git to build from source
yay -S gusscloud-dolphin-bin
```

### Mobile Companion — iOS, Android

Pair with your desktop app to monitor and steer your agents from your phone.

- **iOS:** [Download on the App Store](https://apps.apple.com/us/app/dolphin-ide/id6766130217) or [join TestFlight](https://testflight.apple.com/join/YjeGMQBA)
- **Android:** [Download APK 0.0.50](https://github.com/GussCloud/dolphin/releases/download/mobile-android-v0.0.50/app-release.apk) · [Install guide](https://dolphin.guss.dev.br/docs/android-apk)

---

## Community &amp; Support

- **Discord:** Join the community on **[Discord](https://discord.gg/fzjDKHxv8Q)**.
- **Twitter / X:** Follow **[@dolphin_build](https://x.com/dolphin_build)** for updates and announcements.
- **WeChat:** Scan to join the Dolphin community WeChat group 10.

  <img src="docs/assets/wechat-qr-group10.jpg" alt="WeChat group 10 QR code for the Dolphin community" width="160" />

- **Feedback &amp; Ideas:** We ship fast. Missing something? [Request a new feature](https://github.com/GussCloud/dolphin/issues).
- **Privacy:** See the [privacy &amp; telemetry docs](https://dolphin.guss.dev.br/docs/telemetry) for what anonymous usage data Dolphin collects and how to opt out.
- **Show Support:** [Star](https://github.com/GussCloud/dolphin) this repo to follow along with our daily ships.

---

## Developing

Want to contribute or run locally? See our [CONTRIBUTING.md](.github/CONTRIBUTING.md) guide.

The relay that pairs the mobile app with a desktop host is also in this repository under
[`cloud/`](cloud/README.md), with a separate pnpm workspace and setup guide.

<a href="https://github.com/GussCloud/dolphin/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=GussCloud/dolphin" alt="Dolphin contributors" />
</a>

<p align="center">
  <img src="docs/assets/star-history.png" alt="GitHub star history chart for GussCloud/dolphin" width="880" />
</p>

## Signed Builds

Windows code signing sponored/provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).

## License

Dolphin is free and open source under the [MIT License](LICENSE).
