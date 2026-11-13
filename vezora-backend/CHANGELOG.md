# Vezora v1.0.0 — Integração Mercado Pago

- Backend: validação do sinal por valor/recebedor/referência/moeda, identificação opcional do dispositivo para Pix, detalhamento do item e informação do comprador, data real de aprovação na conciliação da mensalidade.
- Mantém checkout de cartão no Mercado Pago. Nenhum dado de cartão é capturado.

## 0.4.0
- v0.4: validação segura de PATCH, readiness de pagamentos, verificação de webhooks em s/ms, refresh OAuth e desconexão MP protegida.

# Vezora v0.3.0 — revisão de UI e correção do backend

- Backend: usa MONGODB_URI em Prisma, normaliza WEB_URL, permite iniciar sem configuração Mercado Pago.
- Frontend: nova identidade Vezora, favicon, ícones, Open Graph e manifesto PWA.
- Nova navegação mobile, layout otimizado para 320px até desktop.
- Formulários de cadastro/login acessíveis, link do estabelecimento com domínio atual.
- Painel e páginas públicas com melhorias de usabilidade, mensagens de erro e mobile.
- Fluxo de agendamento mantém os dados após erro e informa falha ao consultar disponibilidade.

Observação: dependências npm não foram instaladas neste ambiente por DNS indisponível. É necessário validar builds e teste integrado com MongoDB/Heroku antes de produção.
