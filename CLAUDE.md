@AGENTS.md

# Mensagens Durante o Trabalho

Mensagens enviadas pelo app durante uma execução podem chegar atrasadas à sessão.

- Ao receber uma mensagem do usuário no meio do trabalho, confirme o recebimento na hora, em uma linha, dizendo o que ela pede.
- Se uma resposta do usuário parecer não fazer sentido para a pergunta feita, considere que ele pode estar se referindo a um pedido que ainda não chegou e pergunte qual é antes de seguir.

# Exploração de Arquitetura Antes de Implementar

Toda demanda começa por uma exploração de arquitetura em nível sênior. Nenhum código é escrito antes de ela estar completa e apresentada ao usuário.

- **Siga cada fluxo de ponta a ponta no código**, etapa por etapa, do gatilho do usuário (clique, comando, evento) até o efeito final (processo iniciado, prompt recebido, arquivo gravado). Não suponha que um caminho existente "simplesmente funciona" com a sua entrada: leia o que ele faz com ela.
- **Mapeie todos os caminhos paralelos** que o mesmo fluxo pode tomar: desktop IPC e runtime RPC, main e renderer (quem inicia o processo e quando), local, SSH e WSL, git worktree e folder workspace, cada agente suportado e o seu modo de entrega de prompt.
- **Pergunte o que o ambiente real faz** em cada etapa: telas da CLI do agente (confiança de pasta, onboarding, login), timing de prontidão, estado já existente do usuário. Sinais no código (ex.: presets existentes para um problema) indicam riscos conhecidos: investigue-os.
- **Liste os pontos onde o fluxo pode falhar em silêncio** e como cada um será verificado: teste, execução no app (`AGENTS.md` → Electron UI Validation) ou captura real.
- **Apresente o mapa ao usuário** (etapas com `arquivo:linha`, riscos, plano de verificação) antes de propor a implementação. Ao corrigir um bug, o mapa deve apontar a etapa exata da falha com evidência, não uma hipótese.

# Encerramento de Demanda

Ao concluir cada demanda, nesta ordem:

1. Faça 3 perguntas ao usuário sobre pontos em aberto, riscos ou próximos passos da demanda.
2. Pergunte ao usuário, com a ferramenta de perguntas (`AskUserQuestion`), se a demanda deve gerar uma nova versão. Não suba a versão sem essa resposta.
   - **Sim:** suba o número da versão em `package.json` (commit `chore(release): X.Y.Z`; patch por padrão). Se a demanda altera `mobile/`, suba também a versão do app em `mobile/app.json` (`expo.version` e `android.versionCode` +1; commit `chore(mobile): release X.Y.Z`).
   - **Não:** não altere nenhuma versão.
3. Rode `node config/scripts/verify-pr-local.mjs` uma única vez na árvore final (ver `AGENTS.md` → Verifying Changes); a suíte completa, e2e e empacotamento ficam com o CI.
4. Antes do PR, liste ao usuário todos os pedidos recebidos nesta demanda (inclusive complementos enviados durante o trabalho) com o estado de cada um, para que ele perceba se algum não chegou. Depois abra o PR para `main` seguindo `.github/pull_request_template.md` (com ou sem bump, conforme o passo 2).
5. Acompanhe as validações do PR (CI) e faça o merge somente se todas passarem; se alguma falhar, investigue e reporte antes de qualquer merge.
   - Nunca pare a demanda esperando alguém re-executar um job manualmente. Se uma falha parece não ser do PR e o re-run não é possível (ex.: 403 da integração), dispare o CI de novo com um commit real e útil ao PR (ex.: um teste que faltava), nunca com commit vazio nem fechando e reabrindo o PR. Se falhar de novo, trate como falha real: investigue a causa e corrija ou reporte, sem ficar aguardando.
