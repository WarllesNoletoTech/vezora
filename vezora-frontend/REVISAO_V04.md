# Vezora v0.4 — Revisão do Frontend

## Correções desta versão
- Tela **Minha marca**: o PATCH /api/tenant envia apenas os 10 campos editáveis. Não envia id, ownerId, slug ou createdAt; o backend continua validando com schema estrito.
- Painel: as consultas a serviços, profissionais, reservas e status Mercado Pago são independentes após validar a sessão. Falha isolada não desmonta todo o painel.
- Serviços/profissionais: editar um item inativo não o reativa; erros aparecem dentro do próprio modal.
- Serviço: ao trocar a modalidade de sinal, o valor é zerado para evitar carregar valores incompatíveis.
- Página pública: serviços com sinal sem pagamentos habilitados não deixam avançar para agendamento; horários antigos são limpos durante atualização e botão de continuar fica desabilitado enquanto consulta.
- Página pública: tratamento de erro de carregamento com botão de tentar novamente, sem spinner infinito.
- WhatsApp manual: números com DDD 55 são normalizados corretamente (não confundir DDD 55 com prefixo internacional 55).
- Consulta de reserva: horário apresentado no fuso do estabelecimento e verificação periódica enquanto aguarda confirmação de pagamento.
- Proxy de API Vercel: respostas sem corpo HTTP 204/205/304 tratadas corretamente.

## Variável na Vercel
`API_INTERNAL_URL=https://vezora-61582772c979.herokuapp.com`

- Aplicar à Production e executar um novo deploy.
- Não adicione MONGODB_URI, JWT_SECRET, TOKEN_ENCRYPTION_KEY nem credenciais MP ao frontend.

## Homologação recomendada
1. Entrar e editar **Minha marca**, alterando cores, descrição e salvando sem erro 400.
2. Cadastrar serviço, desativar e editar: deve permanecer inativo.
3. Cadastrar profissional, desativar e editar: deve permanecer inativo.
4. Conferir agendamento público, verificar mudança de horários e pagamento de sinal com/sem MP conectado.
5. Verificar painel em 320, 390, 768 e 1280 pixels.

Esta é uma revisão de código com verificações sintáticas e testes de auxiliares; o build Next.js e a navegação real em produção dependem da instalação npm e do seu deploy.
