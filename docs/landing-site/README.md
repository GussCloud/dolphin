# @dolphin/site

Marketing site for Dolphin (`https://dolphin.guss.dev.br`). A self-contained Next.js app, kept out of the root pnpm workspace like `docs/site`.

```bash
cd site
pnpm --ignore-workspace install
pnpm --ignore-workspace dev     # http://localhost:3005
pnpm --ignore-workspace build
pnpm --ignore-workspace start
```

- `/` — landing page
- `/download` — Windows installer and Android companion links (GitHub Releases)

Brand assets in `public/` (`logo.svg`, `favicon.png`, `apple-icon.png`) come from the Dolphin brand kit; agent icons in `public/agents/` are copied from `src/shared/agent-icons/`. Product visuals are HTML/CSS illustrations (`src/components/product-illustrations.tsx`) rather than recordings, because the existing feature-wall recordings still show upstream branding.

The docs zone (`docs/site`) is deployed separately and served under `/docs`; see its README for the rewrite setup.
