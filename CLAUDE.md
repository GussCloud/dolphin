@AGENTS.md

# Encerramento de Demanda

Ao concluir cada demanda, nesta ordem:

1. Faça 3 perguntas ao usuário sobre pontos em aberto, riscos ou próximos passos da demanda.
2. Suba o número da versão em `package.json` (commit `chore(release): X.Y.Z`; patch por padrão).
3. Abra o PR para `main` seguindo `.github/pull_request_template.md`.
4. Acompanhe as validações do PR (CI) e faça o merge somente se todas passarem; se alguma falhar, investigue e reporte antes de qualquer merge.
