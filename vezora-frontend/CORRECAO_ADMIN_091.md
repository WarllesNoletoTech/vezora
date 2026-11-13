# Vezora frontend v0.9.1 — correção da tela branca do administrador

A rota `/admin` deixou de usar `next/dynamic({ssr:false})` na entrada. O estado inicial é pré-renderizado pelo servidor, para não depender de JavaScript para exibir uma mensagem. A UI inicial também apresenta link para `/admin/diagnostico`.

- API admin summary é validada antes de criar estado.
- Contadores de status ausentes usam `0`, sem chamar `toLocaleString` de `undefined`.
- O resumo financeiro tolera resposta incompleta, exibindo uma mensagem em vez de quebrar a página.
- O projeto preserva o restante da v0.9. Não requer `db:push` nem alterações no backend.

## Deploy
1. Substitua os arquivos do repositório frontend, sem apagar as variáveis do projeto.
2. Faça commit e push na branch publicada pela Vercel.
3. Confira o deployment Production e faça recarga forçada (`Ctrl+Shift+R`).
4. Abra `/admin/diagnostico` para verificar `GET /api/health`, `/api/me` (perfil `SUPERADMIN`) e `/api/admin/summary`.

## Limite de validação
A causa exata da tela branca em produção não pode ser confirmada sem a primeira mensagem de erro do Console (F12) e o deployment efetivamente publicado. Este patch elimina uma hipótese concreta no código e torna falhas futuras mais visíveis. Ainda é necessário realizar build Next.js e testar no ambiente real.
