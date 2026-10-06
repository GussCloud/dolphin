@AGENTS.md

# Encerramento de Demanda

Ao concluir cada demanda, nesta ordem:

1. Faça 3 perguntas ao usuário sobre pontos em aberto, riscos ou próximos passos da demanda.
2. Pergunte ao usuário, com a ferramenta de perguntas (`AskUserQuestion`), se a demanda deve gerar uma nova versão. Não suba a versão sem essa resposta.
   - **Sim:** suba o número da versão em `package.json` (commit `chore(release): X.Y.Z`; patch por padrão). Se a demanda altera `mobile/`, suba também a versão do app em `mobile/app.json` (`expo.version` e `android.versionCode` +1; commit `chore(mobile): release X.Y.Z`).
   - **Não:** não altere nenhuma versão.
3. Abra o PR para `main` seguindo `.github/pull_request_template.md` (com ou sem bump, conforme o passo 2).
4. Acompanhe as validações do PR (CI) e faça o merge somente se todas passarem; se alguma falhar, investigue e reporte antes de qualquer merge.
