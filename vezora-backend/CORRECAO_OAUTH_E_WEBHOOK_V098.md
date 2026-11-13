# Vezora backend v0.9.8 — OAuth e Webhooks

## Causa comprovada no código

Na v0.9.7, `app.use('/api',auth,subscriptionGuard,financialRoutes)` era montado antes de `/api/payments/callback`, `/api/payments/webhook`, `/api/payments/webhook/:tenantId` e `/api/billing/webhook`. Como `app.use('/api', ...)` intercepta qualquer caminho iniciado por `/api`, o middleware `auth` exigia cookie de sessão até nas notificações e no retorno do Mercado Pago. Isso produzia `401` / `Entre na sua conta`.

## Correção

A montagem do router financeiro foi movida para depois das rotas de autenticação externa, webhooks e `/api/admin`, mas antes do fallback `404`. Portanto, **as rotas financeiras mantêm auth + subscriptionGuard**, e OAuth/Webhooks podem funcionar sem cookie de lojista. A segurança dos endpoints externos continua com `state` + PKCE no OAuth e validação `x-signature` nos webhooks.

## Deploy

1. Substitua o backend pela pasta deste pacote, commit e push ao GitHub; aguarde o build do Heroku.
2. Nenhuma variável nova, nenhuma migração Prisma/MongoDB e nenhuma atualização frontend para esta correção.
3. Em Mercado Pago Marketplace, mantenha Redirect URL `https://vezora-61582772c979.herokuapp.com/api/payments/callback` e PKCE = Sim. No webhook de Teste, URL `https://vezora-61582772c979.herokuapp.com/api/payments/webhook`; marque `Pagamentos (legacy)` (fluxo `/checkout/preferences`).
4. Salve as credenciais `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_REDIRECT_URI`, `MP_WEBHOOK_SECRET` no backend Heroku.
5. Após deploy, abra uma sessão de lojista no Vezora, vá a Mercado Pago e clique Conectar conta. Não reabra manualmente callback com `code`/`state` antigo: esses valores são temporários e de uso único.
6. Caso falhe, inspecione `heroku logs --tail -a vezora` e não publique código OAuth nem credenciais.

## Verificações locais

Conferência estática da ordem do middleware e sintaxe transpile do arquivo. **Build completo e autenticação real do Mercado Pago ainda pendentes de homologação no Heroku.**
