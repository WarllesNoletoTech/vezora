# Vezora backend 1.0.7

- MongoDB GridFS para upload de logo e capa (`mongodb` driver oficial) — os uploads não dependem do disco efêmero do Heroku.
- Rotas `PUT/DELETE /api/tenant/media/:kind` autenticadas e `GET /api/media/:tenantId/:kind/:fileId` pública restrita à mídia atual.
- Segurança: validação de formato e assinatura binária, tamanho limitado, separação por estabelecimento, acesso somente ao dono.
- `Tenant.onboardingCompletedAt` opcional e rota autenticada `PATCH /api/tenant/checklist/complete` para persistir o guia entre dispositivos.
- Sem alterações em rotas financeiras e do OneSignal.
