# Vezora v0.6

- Painel superadministrador `/admin` com KPIs, gestão de estabelecimentos, usuários, pagamentos, preços e auditoria.
- Preço global de assinatura salvo em `PlatformSettings` no MongoDB.
- Telefone de contato obrigatório nos novos cadastros e em perfis legados incompletos.
- Controle de suspensão e concessão manual auditada de dias de acesso.
- Relatórios Pix distinguem pagamentos efetivos de concessões administrativas.
- Script `npm run admin:promote -- --email ...` no backend.
- Compatibilidade de leitura com campos legados ausentes.
