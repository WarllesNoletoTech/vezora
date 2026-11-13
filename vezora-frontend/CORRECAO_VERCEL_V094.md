# Vezora Frontend v0.9.4 — Correção da Vercel

## Alterações
- Next.js: 15.5.0 → 15.5.29 (correção de segurança publicada em 03/11/2026).
- React e react-dom: 19.1.0 → 19.3.1, com versões idênticas para evitar conflito de peer dependencies.
- Demais funções do frontend preservadas (não foram modificadas rotas, componentes ou configurações de API).

## Como publicar pelo GitHub e Vercel
1. Copie todo o conteúdo da pasta `vezora-frontend` para a raiz do repositório frontend, sem criar pasta extra.
2. Se existir `package-lock.json` antigo no repositório, regenere-o em um computador com internet executando `npm install`. Inclua o novo `package-lock.json` no commit. Não mantenha o lockfile da versão antiga.
3. Rode `npm run build` localmente. Corrija erros adicionais exibidos pelo build antes do deploy.
4. Commit/push na branch Production; depois abra Deployments da Vercel. Se houver cache de dependências desatualizadas, faça Redeploy sem reaproveitar build cache.
5. Na Vercel, mantenha `API_INTERNAL_URL=https://vezora-61582772c979.herokuapp.com`.

## Avisos não fatais do log anterior
- O campo `engines.node = 24.x` tem prioridade sobre a opção de Node 26.x selecionada no painel Vercel. Node 24 foi mantido intencionalmente, em linha com o backend Heroku.
- `npm warn Unknown env config cache-dir` é um aviso de npm, não a causa do bloqueio de segurança.
- Uma eventual falha posterior de TypeScript/rotas será um problema diferente e exigirá o log completo.

## Validação
- `package.json` alterado e parseado como JSON válido.
- Versões React/React DOM verificadas como idênticas.
- Sintaxe dos fontes verificada localmente com o parser TypeScript (sem resolver dependências).
- Build real `next build` não executado, porque o registro npm não está acessível neste ambiente.

## Fontes
- https://nextjs.org/blog/november-2026-security-release
- https://react.dev/blog/2026/09/09/react-19-3
