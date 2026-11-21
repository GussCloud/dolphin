@AGENTS.md

# Mensagens Durante o Trabalho

Mensagens enviadas pelo app durante uma execução podem chegar atrasadas à sessão.

- Ao receber uma mensagem do usuário no meio do trabalho, confirme o recebimento na hora, em uma linha, dizendo o que ela pede.
- Se uma resposta parecer não fazer sentido para a pergunta feita, considere que ela pode se referir a um pedido que ainda não chegou e pergunte qual é antes de seguir.

# Antes de Implementar: Profundidade Proporcional ao Risco

| Demanda   | Exemplos                                                                                                                           | O que fazer                                                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Pequena   | 1–2 arquivos, sem mudar contrato nem cruzar processos                                                                              | Implemente direto e rode o teste focado                                                                                                         |
| Média     | Uma feature dentro de uma camada                                                                                                   | Plano curto no chat (fluxo, riscos, como verificar) e siga, salvo ambiguidade                                                                   |
| Arriscada | IPC/RPC e protocolo cliente-host, SSH/WSL, lançamento de agentes, contas, dados do usuário, CI/release, código nativo de `mobile/` | Siga o fluxo de ponta a ponta com `arquivo:linha`, liste onde pode falhar em silêncio e como será verificado, e apresente o mapa antes de codar |

Bug fix, em qualquer tamanho: aponte a etapa exata da falha com evidência (não hipótese) antes de corrigir.

# Evidência

A evidência é o CI, nunca uma etapa do agente. O agente **não** abre o app, não tira screenshot, não grava vídeo e não sobe outro agente para provar o resultado; no PR ele aponta os checks do CI.

- **O que o agente faz:** escreve ou atualiza o teste que prova a mudança, na camada certa (UI: teste e2e do fluxo em `tests/e2e/`; API/backend: contrato e testes; performance: o contrato ou benchmark do CI; integração: teste contra o componente real). O CI roda; o agente só roda localmente os testes focados do que mudou.
- **Rótulo de origem** em toda afirmação de que algo funciona: `app real (CI)`, `teste com mock de X` ou `reconstrução`. Mock e reconstrução nunca são apresentados como prova do comportamento real.
- **Bug fix:** o teste de regressão precisa falhar sem a correção (rode-o no commit base e mostre) e não pode mockar a camada que a correção altera.
- **O que o CI não cobre** (aparelho físico, host SSH real, macOS) fica escrito no PR como "não verificado em X"; não é motivo para o agente tentar verificar por conta própria.

# Portões do Pipeline

O check obrigatório `verify` bloqueia só três coisas: **código quebrado** (typecheck, testes, empacotamento, contratos de plataforma e os e2e que o PR criou ou alterou), **segurança** e **performance**. Regras de estilo e tamanho só geram aviso. O PR roda só os e2e dele; a suíte e2e completa roda na `develop` duas vezes ao dia (`e2e-develop`, que abre uma issue quando falha) e antes de cada promoção. Formatação, lint corrigível e catálogos gerados se resolvem localmente com `node config/scripts/verify-pr-local.mjs --fix`.

# Versão e Release

- PR nunca altera versão (`package.json`, `mobile/app.json`).
- Beta sai do workflow `release-beta` a cada merge em `develop` (só do app que mudou); versão oficial sai do `release-promote`, sempre manual e aprovada pelo dono. Ele roda a suíte e2e completa no commit promovido e só publica e avança `main` com ela verde. Veja [`docs/reference/release-process.md`](./docs/reference/release-process.md).

# Encerramento de Demanda

1. Rode `node config/scripts/verify-pr-local.mjs --fix` uma única vez na árvore final; a suíte completa, e2e e empacotamento ficam com o CI.
2. Se a demanda teve mais de um pedido (inclusive complementos durante o trabalho), liste-os com o estado de cada um antes do PR.
3. Abra o PR para `develop` (nunca `main`) seguindo `.github/pull_request_template.md`. O merge em `develop` gera o beta sozinho; a promoção para oficial segue manual e aprovada pelo dono, e só então `main` avança.
4. Acompanhe o CI. Faça merge quando o `verify` estiver verde; se falhar, investigue e corrija ou reporte.
   - Nunca pare esperando alguém re-executar um job. Se uma falha não é do PR e o re-run não é possível, dispare o CI de novo com um commit real e útil (ex.: um teste que faltava), nunca com commit vazio nem fechando e reabrindo o PR. Se falhar de novo, trate como falha real.
