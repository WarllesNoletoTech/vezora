# Vezora v0.5 — Temas por negócio, migração de contas e assinatura Pix

## 1. Publicação sem perder os dados

Esta versão mantém as coleções atuais do MongoDB e **adiciona campos opcionais** ao estabelecimento (`businessType`, `trialStartsAt`, `subscriptionEndsAt`) e a coleção `SubscriptionPayment`.

1. Faça um snapshot/backup no MongoDB Atlas antes do deploy.
2. Atualize o repositório `vezora-backend` e publique no Heroku.
3. Configure as variáveis novas listadas abaixo.
4. No terminal do Heroku, execute `heroku run npm run db:push -a vezora`.
5. Atualize `vezora-frontend` na Vercel e execute um novo deploy de produção.
6. Teste uma conta antiga e uma conta de teste nova.

**Não apague dados de usuários nem coleções.** `prisma db push` sincroniza o modelo e seus índices sem executar seed destrutivo.

## 2. Frontend Vercel

```env
API_INTERNAL_URL=https://vezora-61582772c979.herokuapp.com
```

## 3. Backend Heroku — configuração existente

```env
MONGODB_URI=mongodb+srv://USUARIO:SENHA@SEU-CLUSTER.mongodb.net/vezora?retryWrites=true&w=majority
NODE_ENV=production
WEB_URL=https://vezora-agendamentos.vercel.app
API_PUBLIC_URL=https://vezora-61582772c979.herokuapp.com
JWT_SECRET=SUA_CHAVE_SECRETA_COM_PELO_MENOS_32_CARACTERES
TOKEN_ENCRYPTION_KEY=CHAVE_HEXADECIMAL_COM_64_CARACTERES
```

## 4. Backend Heroku — NOVAS variáveis da assinatura da plataforma

```env
# O preço em centavos deve ser definido por você ANTES de cobrar alguém.
# Exemplo: 3990 = R$39,90 (apenas exemplo; não é preço aprovado)
VEZORA_MONTHLY_PRICE_CENTS=0

# Credencial de acesso da própria conta do Vezora. Não é a conta do lojista.
VEZORA_MP_ACCESS_TOKEN=

# Chave secreta da assinatura de Webhooks para a aplicação principal Vezora.
VEZORA_MP_WEBHOOK_SECRET=

# Opcional; recomendado para conferir o vendedor dos pagamentos.
VEZORA_MP_COLLECTOR_ID=
```

**ATENÇÃO:** o valor `0` mantém o pagamento desativado para prevenir cobranças acidentais. Antes de abrir o SaaS ao público, escolha o valor da mensalidade e configure o token e o segredo dos webhooks do seu Mercado Pago. O sistema bloqueará o acesso quando o teste vencer, mas, enquanto o Pix não estiver configurado, mostrará uma mensagem de indisponibilidade em vez de um boleto/pagamento fictício.

### Webhook da assinatura

Registre no painel do Mercado Pago a URL:

`https://vezora-61582772c979.herokuapp.com/api/billing/webhook`

Selecione eventos de pagamento. Ative a assinatura e teste **com ambiente de homologação** antes de aceitar cobranças reais. O backend só libera o acesso após conferir `approved` via API oficial, validar o valor, a referência externa e o método Pix; o webhook usa assinatura HMAC.

### Integração de SINAL dos lojistas (separada)

Continua usando `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_REDIRECT_URI`, `MP_WEBHOOK_SECRET` para OAuth e pagamentos por Pix/cartão aos vendedores. **Não substitua** essas variáveis pelo token da plataforma.

## 5. Fluxos

- **Cadastro novo:** tipo de negócio obrigatório; início imediato de 72 horas de teste grátis.
- **Contas antigas:** ao entrar, vão para `/atualizar-cadastro` e escolhem a categoria; recebem 72 horas de teste a partir dessa atualização se ainda não possuíam início de teste.
- **Tema:** cores + visual da categoria aplicados no cadastro; o lojista pode mudar sua paleta e seu tipo de negócio na aba Minha marca.
- **Fim do teste:** painel e gravação de reservas são bloqueados pela API. Página pública ainda pode ser vista, mas não aceita novas reservas.
- **Pix:** loja paga sua **assinatura do Vezora** com Pix avulso. A cada aprovação, libera 30 dias. **Não é renovação automática**: será necessário pagar um novo Pix ao vencer.
- **Sem cobrança indevida:** não debita automaticamente e nunca considera QR gerado como pagamento aprovado.

## 6. Testes recomendados para homologação

1. Cadastrar barbearia, confirmar cores grafite/cobre e página pública com tema barbearia.
2. Cadastrar nail designer e verificar que cores e elementos são diferentes.
3. Fazer login em conta criada na v0.4 e escolher categoria; conferir serviços existentes.
4. Criar serviço, configurar profissional, testar reserva e conflito de horário.
5. Usar uma conta de teste com `trialStartsAt` artificialmente anterior a 3 dias **somente em ambiente de teste**; confirmar bloqueio do painel e do agendamento público.
6. Configurar credenciais de teste do Mercado Pago, gerar QR Pix, confirmar via webhook e reabrir o painel.
7. Enviar o mesmo evento de webhook duas vezes e confirmar que o prazo não é duplicado.
8. Não abrir produção sem conferir build e testes reais com Heroku, Vercel e MongoDB.

## 7. Segurança

Não salve segredos no frontend. Nunca compartilhe URI do MongoDB com senha, JWT ou tokens. Como chaves apareceram em capturas de tela anteriores, renove as credenciais antes do uso comercial.

## 8. Status de validação

A sintaxe TS/TSX foi verificada e o comportamento das regras de assinatura foi testado em simulação. As telas de referência passaram por testes estáticos de layout em 320, 360, 390, 768 e 1280 px. O build integral não foi executado porque o registro npm não estava disponível neste ambiente. **A integração Pix em ambiente real ainda não foi homologada.**
