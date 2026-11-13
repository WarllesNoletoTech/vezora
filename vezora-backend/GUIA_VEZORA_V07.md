# Vezora v0.7 | Relatórios, equipe e Mercado Pago

## Atualizações incluídas

**Painel do lojista → Financeiro**
- Resumo por período (data do atendimento no fuso da loja): faturamento de serviços concluídos, valores recebidos, sinais Mercado Pago aprovados, saldo ainda não recebido e comissões previstas.
- Relatórios por serviço e por profissional; detalhamento dos atendimentos; salários mensais cadastrados; formas de pagamento registradas manualmente.
- Registro de pagamento complementar quando um atendimento é marcado como CONCLUÍDO, com Pix, dinheiro, débito, crédito, transferência e outro. Permite vários recebimentos parciais; bloqueia valor superior ao saldo.
- Estorno lógico de lançamento manual com motivo obrigatório (o registro permanece preservado no banco).
- Download PDF com logo do Vezora, nome da loja, período, resumo e tabelas. A geração ocorre no backend com acesso autenticado.
- Preço e comissão congelados nos agendamentos NOVOS. Em históricos antigos, se não houver snapshot, o relatório usa o preço/comissão atuais como **estimativa** e avisa expressamente.

**Painel do lojista → Profissionais**
- Vínculo: Dono(a), Funcionário(a) ou Autônomo(a)/prestador(a).
- Salário opcional com valor **mensal**, comissão opcional por **porcentagem inteira** ou **valor fixo por atendimento**.
- Salário e comissão registrados são valores previstos, não comprovantes de pagamento de folha/repasses.

## Deploy seguro (sem excluir a base de dados)

1. Faça um backup do MongoDB Atlas.
2. Envie a pasta `vezora-backend` para o repositório Heroku (raiz = essa pasta).
3. Confirme o build na aba Activity/Build Logs do Heroku.
4. Execute `heroku run npm run db:push -a vezora` para sincronizar os novos campos/coleção.
5. Execute `heroku run npm run db:backfill-v07 -a vezora` para preencher campos obrigatórios que faltam nos documentos antigos, sem apagar dados. Profissionais antigos recebem vínculo inicial de **funcionário**, que pode ser corrigido no painel para **dono** ou **autônomo**.
6. Envie a pasta `vezora-frontend` para o repositório Vercel. Não precisa de novas variáveis no frontend.
7. Recarregue `/painel`, edite um profissional (dono/funcionário, salário e comissão), conclua um agendamento, registre um recebimento em Financeiro e baixe um PDF.

**O código usa Node 24.x e Prisma 6.19.0.** Backend precisa de `pdfkit` (declarado em dependencies no package.json; Heroku instala no build). O arquivo `vezora-icon.png` deve permanecer na raiz do projeto backend para ser impresso nos relatórios.

**Variáveis existentes continuam iguais.** Front: `API_INTERNAL_URL`. Back: `MONGODB_URI`, `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `WEB_URL`, `API_PUBLIC_URL` e credenciais MP, quando habilitadas. Não coloque access tokens no frontend.

## Como usar os relatórios

1. Marque o atendimento como **Concluído** na aba Agendamentos.
2. Abra **Financeiro**, filtre as datas e verifique o faturamento. Se houve sinal aprovado, ele é contado automaticamente como recebido no atendimento concluído.
3. Na lista de atendimentos, clique em **Registrar** no saldo restante e informe valor + forma de pagamento real. Nunca registre um Pix como recebido sem verificar na sua conta se foi pago — os lançamentos manuais não consultam Mercado Pago.
4. Clique em **Baixar PDF Vezora**. O PDF será baixado pelo navegador autenticado.

**Limitações conscientes:** salários são mensalidades previstas (sem folha de pagamento/encargos); comissões são previstas e não indicam repasse efetuado; relatórios por data do atendimento e não por data bancária de liquidação. O estorno de um sinal Mercado Pago precisa ser feito no Mercado Pago, e a reconciliação bancária exige validação de pagamento/refund webhook. O PDF é relatório gerencial, não nota fiscal.

## Mercado Pago: uma ou duas aplicações?

Recomendação: **duas aplicações de integração no Mercado Pago**, usando a conta administrativa do Vezora; um único Heroku e um único frontend continuam suficientes. A conta Mercado Pago de cada lojista é individual para receber o sinal. Separar as aplicações é recomendação operacional, não exigência geral da API.

### Aplicação 1: `Vezora Assinaturas` (você recebe as mensalidades via Pix)

1. Entre em https://www.mercadopago.com.br/developers/panel/app e faça login com a conta Mercado Pago que receberá as mensalidades.
2. **Criar aplicação** → Pagamentos online → Checkout Transparente/API (pagamento Pix). Selecione modelo de venda própria, não marketplace.
3. Configure sua chave Pix na conta Mercado Pago e obtenha o **Access Token de produção** da aplicação.
4. Na aplicação, vá a **Webhooks / Configurar notificações** e configure URL de produção:
   `https://vezora-61582772c979.herokuapp.com/api/billing/webhook`
5. Ative eventos de pagamento, salve e copie a **assinatura secreta** gerada para essa aplicação.
6. No Heroku, configure:
   - `VEZORA_MP_ACCESS_TOKEN` = Access Token de produção da aplicação 1.
   - `VEZORA_MP_WEBHOOK_SECRET` = assinatura secreta do webhook da aplicação 1.
   - `VEZORA_MP_COLLECTOR_ID` = ID numérico da conta que recebe a mensalidade (opcional tecnicamente, recomendado como verificação adicional).
7. Defina o valor da mensalidade no **painel /admin** do Vezora. A cobrança de cada ciclo é Pix avulso, sem débito automático mensal.
8. Em ambiente de teste, gere Pix e valide a atualização de estado por webhook e consulta autenticada ao provedor; só libere pagamentos em produção depois de homologar.

### Aplicação 2: `Vezora Marketplace` (lojistas recebem sinais Pix e cartão)

1. No mesmo painel de integrações, **Criar aplicação** → Pagamentos online → Checkout Pro → modelo **Marketplace**.
2. Configure a URL de retorno (OAuth):
   `https://vezora-61582772c979.herokuapp.com/api/payments/callback`
3. Copie **Client ID** e **Client Secret**.
4. Na aplicação Marketplace, vá a **Webhooks / Configurar notificações**. Configure uma URL genérica:
   `https://vezora-61582772c979.herokuapp.com/api/payments/webhook`
   Selecione eventos de pagamentos disponíveis, salve e copie a **assinatura secreta** da aplicação 2.
5. No Heroku, configure:
   - `MP_CLIENT_ID` = Client ID da aplicação 2.
   - `MP_CLIENT_SECRET` = Client Secret da aplicação 2.
   - `MP_REDIRECT_URI` = URL do passo 2 (deve coincidir exatamente).
   - `MP_WEBHOOK_SECRET` = assinatura secreta da aplicação 2.
6. No painel do Vezora, cada lojista acessa **Mercado Pago → Conectar minha conta** e autoriza o Vezora na sua conta Mercado Pago; a API guarda token/refresh criptografados para o estabelecimento.
7. Quando um cliente paga sinal, o Checkout Pro usa o **token OAuth do lojista**. O Vezora não recebe esse dinheiro e não cobra comissão por transação. A preferência gerada pelo backend usa `notification_url` com o ID do estabelecimento, substituindo a URL genérica para que o webhook concilie a reserva corretamente.
8. Teste os dois meios de pagamento (Pix e cartão), aprovação, pendência, expiração e estorno antes de habilitar em produção.

### Por que as credenciais devem ficar separadas?

- `VEZORA_MP_*`: pagamento de mensalidade **para você**.
- `MP_*`: OAuth e pagamento de sinal **para os lojistas**.
- Nunca use o Access Token de uma aplicação como `Client Secret` da outra; não exponha nenhum deles na Vercel ou repositório.
- Webhooks têm assinaturas secretas **diferentes** por aplicação; não reutilize.
- Na conta dos lojistas, autorize acesso somente via OAuth oficial, sem copiar chaves ou senhas.

Fontes oficiais:
- OAuth: https://www.mercadopago.com.br/developers/pt/docs/security/oauth/introduction
- Marketplace: https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/create-configuration
- Pix: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix
- Webhooks: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks

## Validação e cuidados

- Teste `npm run build` **nos dois projetos** após instalar dependências; não foi possível realizar o build completo neste ambiente sem acesso ao registro npm.
- Teste a API financeira e o PDF autenticado com dados de teste; prefira um relatório mensal de demonstração antes de usar com clientes.
- Verifique o plano Heroku e MongoDB Atlas para uso comercial; use HTTPS e política de privacidade/LGPD.
