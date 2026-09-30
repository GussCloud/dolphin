<h1 align="center">
  <img src="../../resources/build/icon.png" alt="Dolphin" width="64" valign="middle" /> Dolphin
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-08C?style=flat" alt="Licença: MIT" />
  <img src="https://img.shields.io/badge/Windows%20%7C%20Android-4493F8?style=flat-square" alt="Plataformas: Windows e Android" />
</p>

<p align="center">
  <sub><a href="../../README.md">English</a> · Português</sub>
</p>

<p align="center">
  <strong>Rode agentes de código lado a lado, cada um na sua worktree, acompanhados em um só lugar.</strong><br/>
  Codex, Claude Code, OpenCode, Pi ou qualquer outro agente de terminal.
</p>

<h3 align="center"><a href="https://github.com/GussCloud/dolphin/releases/latest"><ins>Baixar o Dolphin para Windows</ins></a></h3>

## Recursos

- **Worktrees em paralelo:** envie um prompt para vários agentes, cada um na sua worktree git isolada, compare os resultados e faça merge do melhor.
- **Terminais divididos:** terminais renderizados na GPU, com divisões ilimitadas e histórico que sobrevive a reinícios.
- **Design Mode:** clique em qualquer elemento de uma janela Chromium real para mandar o HTML, o CSS e um recorte da tela para o prompt do agente.
- **GitHub e Linear:** navegue por PRs, issues e quadros de projeto dentro do app e abra uma worktree a partir de qualquer tarefa.
- **Worktrees por SSH e WSL:** rode agentes numa máquina remota ou dentro do WSL, com edição de arquivos, git e terminais.
- **Comentários em diffs de IA:** comente qualquer linha do diff e devolva ao agente; revise, edite e faça commit sem sair do Dolphin.
- **Dolphin CLI:** os próprios agentes controlam o Dolphin com `dolphin worktree create`, `snapshot`, `click` e `fill`.
- **App mobile:** pareie um celular Android com o app de desktop para acompanhar os agentes e mandar novas instruções.

---

## Instalação

### Windows

Baixe o `dolphin-windows-setup.exe` da [release mais recente](https://github.com/GussCloud/dolphin/releases/latest). O instalador ainda não é assinado, então o SmartScreen do Windows pode pedir confirmação antes de executar. O app se atualiza sozinho a partir das mesmas releases.

### Android

Ainda não há APK publicado. Compile o app a partir do código seguindo o [`mobile/README.md`](../../mobile/README.md) (`pnpm exec expo run:android`).

---

## Desenvolvimento

Veja o [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) para configurar o ambiente e para o processo de release.

O relay que conecta o app mobile ao desktop fica em [`cloud/`](../../cloud/README.md), com um workspace pnpm e guia próprios.

## Licença

O Dolphin é livre e de código aberto, sob a [licença MIT](../../LICENSE).
