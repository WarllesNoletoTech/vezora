# Vezora v0.4 — Revisão do Backend

## Correções desta versão
- Validação estrita das alterações de serviços e profissionais; campos internos não podem ser modificados via API.
- Valida continuidade de uma sessão JWT emitida pelo próprio Vezora (`issuer=vezora`).
- Endpoint público do estabelecimento retorna apenas o booleano `paymentAvailable`; tokens e contas continuam privados.
- Antes de ocupar um horário com sinal, valida se Mercado Pago está configurado e se a conta do lojista existe.
- Webhooks MP: assinatura SHA256 verificada com comparação constante; suporta timestamp em segundos ou milissegundos, preservando o timestamp no manifesto de assinatura.
- Refresh de token MP somente próximo do vencimento (margem de 5 minutos), reduzindo chamadas desnecessárias.
- Acompanhamento de reserva inclui fuso do estabelecimento para exibição correta do horário.
- Impede desconexão MP quando há reservas com pagamento recente pendente ou em revisão.

## Variáveis no Heroku
```
MONGODB_URI=mongodb+srv://USUARIO:SENHA@CLUSTER.mongodb.net/vezora?retryWrites=true&w=majority
NODE_ENV=production
WEB_URL=https://vezora-agendamentos.vercel.app
API_PUBLIC_URL=https://vezora-61582772c979.herokuapp.com
JWT_SECRET=(chave secreta gerada localmente, 32+ caracteres)
TOKEN_ENCRYPTION_KEY=(hex aleatório com 64 caracteres)
```
Quando for homologar pagamentos, acrescente `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_REDIRECT_URI`, `MP_WEBHOOK_SECRET`.

## Banco e deploy
- O arquivo `prisma/schema.prisma` é idêntico ao da v0.3: **não há alteração estrutural nem migração obrigatória** para esta revisão.
- O Heroku deve estar apontando para a raiz do repositório `vezora-backend`.
- A implantação executa o script `heroku-postbuild` e inicia `node dist/server.js`.
- Verifique `GET /api/health`, faça login, altere a marca e crie uma reserva de teste.
- Não faça testes de pagamento real sem configurar a integração e homologar OAuth, Checkout Pro e webhook.

## Limites da homologação
Esta entrega foi validada com análise estática do TypeScript/TSX e testes unitários direcionados em ambiente isolado. Não foi possível instalar dependências npm nem executar testes integrados reais contra MongoDB Atlas, Heroku ou Mercado Pago. A compatibilidade com provedores deve ser verificada no seu ambiente antes de publicar para clientes.
