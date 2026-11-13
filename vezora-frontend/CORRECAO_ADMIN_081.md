# Vezora Frontend v0.8.1 — Correção da tela branca em /admin

## Alterações

- `app/admin/page.tsx` agora tem entrada pequena com carregamento seguro via `AdminLoader`.
- A interface completa foi preservada em `app/admin/AdminDashboard.tsx` e carregada separadamente.
- O estado inicial mostra conteúdo mesmo antes da hidratação JavaScript.
- `AdminBoundary` captura falhas inesperadas de renderização e orienta sobre diagnóstico.
- A validação de sessão agora tem timeout de 15 segundos e mostra erro em vez de travar.
- `app/admin/diagnostico` verifica API, sessão e papel `SUPERADMIN` e exibe HTTP status.
- Checagens defensivas de resultados incompletos de API.

## Publicar

1. Atualize apenas o repositório `vezora-frontend` na Vercel. O backend v0.8 continua compatível.
2. Confira que `API_INTERNAL_URL` aponta para a URL base HTTPS do Heroku, sem `/api`.
3. Faça o deploy em Production e confira o commit correto.
4. Abra `/admin/diagnostico`; os três testes devem retornar OK para uma conta SUPERADMIN.
5. Abra `/admin` após atualizar a página com Ctrl+Shift+R.

## Se ainda não abrir

- Se `/admin/diagnostico` também estiver em branco, a versão publicada não contém a correção ou há falha global de renderização/entrega de assets. Verifique Deployment → Build Logs/Runtime Logs na Vercel e Console (F12).
- Se `/api/me` responder 401, entre novamente; se role for `LOJISTA`, é necessário promover a conta pelo comando de admin no Heroku.
- Se `/api/admin/summary` retornar 403, confirme a permissão no backend.
- Se a API responder 500, verifique os logs do Heroku e a conexão com MongoDB.

Não foram feitas alterações no esquema MongoDB nem no backend. Não execute `db:push` para esta correção.
