# vezora-backend — API Vezora (Heroku + MongoDB Atlas)

API Node.js + Express + Prisma **6.19.0** com conector MongoDB. Projeto independente do frontend.

## Executar localmente

1. `npm install`
2. Copie `.env.example` para `.env` e configure `DATABASE_URL` com **MongoDB Atlas (replica set)**, as chaves `JWT_SECRET` e `TOKEN_ENCRYPTION_KEY`.
3. `npm run db:generate`
4. `npm run db:push` (cria coleções e índices; revise mudanças de schema antes de usar em produção).
5. `npm run dev`
6. Acesse `http://localhost:4000/api/health`.

**ATENÇÃO:** O banco exige **replica set**, inclusive para registro e reserva com transação. MongoDB Atlas é indicado. Um `mongod` standalone **não funciona** com as transações deste MVP. Esta base usa UUIDs armazenados como strings no campo `_id`, para manter compatibilidade com os IDs existentes na API e no frontend.

Para criar exemplos locais, opcionalmente rode `npm run db:seed` (**bloqueado em produção**).

## Deploy Heroku

Este ZIP tem uma pasta `vezora-backend/` pronta para ser usada como **raiz de repositório Git independente**. Se publicar a pasta como raiz de outro repositório, o Heroku detectará seu `package.json` e `Procfile` automaticamente.

1. Crie o app Heroku com stack Heroku-24 e Node 24.x (definido no `package.json`).
2. Em Settings → Config Vars, cadastre os valores da `.env.example`, **sem as aspas extras** em campos do painel. Heroku fornece `PORT` automaticamente, não configure `PORT` manualmente.
3. Defina `NODE_ENV=production`, `WEB_URL=https://SEU-FRONT.vercel.app`, `API_PUBLIC_URL=https://SEU-BACK.herokuapp.com` (domínios exatos, sem `/` final), `DATABASE_URL` (MongoDB Atlas), `JWT_SECRET` e `TOKEN_ENCRYPTION_KEY`.
4. Na configuração do MongoDB Atlas, autorize o acesso de rede do Heroku à instância (preferencialmente IP fixo/egress estático ou solução privada). Não exponha credenciais.
5. Faça o deploy. O Heroku executará `heroku-postbuild` → `prisma generate && tsc`; o `Procfile` executará `npm run start` (`node dist/server.js`).
6. **Antes do primeiro cadastro e a cada alteração compatível do schema**, execute `heroku run npm run db:push -a NOME_DO_APP`. Nunca habilite `--accept-data-loss` automaticamente.
7. Verifique `https://SEU-BACK.herokuapp.com/api/health`.

## Mercado Pago

Configure `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_WEBHOOK_SECRET`, `MP_REDIRECT_URI=https://SEU-BACK.herokuapp.com/api/payments/callback` e o mesmo callback na aplicação Marketplace em Mercado Pago Developers. Cada lojista usa OAuth para autorizar sua própria conta. Antes de cobrar, homologar OAuth, checkout, expiração e webhook com credenciais de teste.

## Frontend

No projeto independente `vezora-frontend`, a variável de ambiente **`API_INTERNAL_URL`** aponta para `https://SEU-BACK.herokuapp.com`. O frontend faz proxy de `/api/*` para o backend, preservando o cookie HTTP-only da sessão sem expor a API interna via chaves.

## Segurança e limites deste MVP

- CORS estrito para `WEB_URL`. Se usar domínio customizado, atualize essa variável com a origem exata.
- Não versionar `.env` e não enviar senhas reais na conversa ou em repositórios.
- A reserva é serializada por profissional usando atualização de `bookingRevision` na mesma transação MongoDB; 3 tentativas para conflitos transientes. O banco e índices precisam estar inicializados com `db:push`.
- O período de pagamento é de 15 min; pagamentos tardios entram em revisão manual. Antes de ativar produção, validar chargebacks, reembolsos, idempotência, webhook e concorrência em testes de integração.
- Na passagem de PostgreSQL para MongoDB, **os dados existentes não são migrados automaticamente**. Se havia dados em PostgreSQL, exporte e importe via ferramenta de migração própria.

Documentação: https://www.prisma.io/docs/orm/v6/overview/databases/mongodb

> O pacote `prisma` está em `dependencies` (não `devDependencies`) para que `heroku run npm run db:push` funcione mesmo após o Heroku descartar dependências de desenvolvimento.
