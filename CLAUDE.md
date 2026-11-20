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

Código implementado não é demanda concluída: termine com evidência de que o resultado foi entregue, adequada ao tipo (UI: fluxo no app real; API/backend: contrato e testes; performance: medição antes/depois; integração: comunicação real e falhas).

- **Rotule a origem de toda evidência:** `app real (CI)`, `app real (local)`, `teste com mock de X` ou `reconstrução`. Mock e reconstrução nunca são apresentados como prova do comportamento real.
- **Bug fix:** o teste de regressão precisa falhar sem a correção (rode-o no commit base e mostre) e não pode mockar a camada que a correção altera.
- **O que não dá para verificar aqui** (aparelho físico, host SSH real, Windows/macOS) fica escrito como "não verificado em X".

# Portões do Pipeline

O check obrigatório `verify` bloqueia só três coisas: **código quebrado** (typecheck, testes, empacotamento, contratos de plataforma), **segurança** e **performance**. Regras de estilo e tamanho só geram aviso. Formatação, lint corrigível e catálogos gerados se resolvem localmente com `node config/scripts/verify-pr-local.mjs --fix`.

# Versão e Release

- PR nunca altera versão (`package.json`, `mobile/app.json`).
- Beta sai do workflow `release-beta` a cada merge em `develop` (só do app que mudou); versão oficial sai do `release-promote`, sempre manual e aprovada pelo dono, que depois avança `main`. Veja [`docs/reference/release-process.md`](./docs/reference/release-process.md).

# Encerramento de Demanda

1. Rode `node config/scripts/verify-pr-local.mjs --fix` uma única vez na árvore final; a suíte completa, e2e e empacotamento ficam com o CI.
2. Se a demanda teve mais de um pedido (inclusive complementos durante o trabalho), liste-os com o estado de cada um antes do PR.
3. Abra o PR para `develop` (nunca `main`) seguindo `.github/pull_request_template.md`. O merge em `develop` gera o beta sozinho; a promoção para oficial segue manual e aprovada pelo dono, e só então `main` avança.
4. Acompanhe o CI. Faça merge só com `verify` verde e com evidência real da camada de risco; senão, investigue e reporte.
   - Nunca pare esperando alguém re-executar um job. Se uma falha não é do PR e o re-run não é possível, dispare o CI de novo com um commit real e útil (ex.: um teste que faltava), nunca com commit vazio nem fechando e reabrindo o PR. Se falhar de novo, trate como falha real.
