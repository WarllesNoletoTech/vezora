# Vezora v1.0.0 — Integração Mercado Pago

- Frontend: script de segurança oficial do Mercado Pago na tela de Pix e consulta automática à API no retorno do Checkout Pro (sem confiar no status da URL).

## 0.4.0
- v0.4: PATCH Minha marca corrigido, consultas independentes do painel, modais com erros visíveis, edição de inativos, agendamento público e WhatsApp revisados.

# Vezora v0.3.0 — revisão de UI e correção do backend

- Backend: usa MONGODB_URI em Prisma, normaliza WEB_URL, permite iniciar sem configuração Mercado Pago.
- Frontend: nova identidade Vezora, favicon, ícones, Open Graph e manifesto PWA.
- Nova navegação mobile, layout otimizado para 320px até desktop.
- Formulários de cadastro/login acessíveis, link do estabelecimento com domínio atual.
- Painel e páginas públicas com melhorias de usabilidade, mensagens de erro e mobile.
- Fluxo de agendamento mantém os dados após erro e informa falha ao consultar disponibilidade.

Observação: dependências npm não foram instaladas neste ambiente por DNS indisponível. É necessário validar builds e teste integrado com MongoDB/Heroku antes de produção.

## v1.0.3 — Assinaturas / SDK JS V2
- Aguarda por até 2,5 segundos o identificador oficial do dispositivo antes de solicitar Pix.
- Com `NEXT_PUBLIC_VEZORA_MP_PUBLIC_KEY`, inicializa MercadoPago.js V2 somente na página `/assinatura`.
- Preserva checkout hospedado para cartão recorrente e integração independente do Marketplace.
