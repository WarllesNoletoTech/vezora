# Vezora v0.9.3 — implantação, variáveis e diagnóstico

**Base utilizada:** frontend e backend v0.9.2 fornecidos anteriormente na conversa. **Banco:** MongoDB Atlas. **Infraestrutura:** frontend Next.js na Vercel, backend Express/Prisma no Heroku.

## A. O que mudou

- O painel `/admin` usa uma entrada renderizada no servidor e uma `ErrorBoundary` estática para não depender do antigo import dinâmico da área inteira.
- Quando a sessão estiver inválida ou for de lojista, a área administrativa oferece uma ação **Limpar sessão e entrar**, que chama `/api/auth/logout` e abre a tela de login.
- O cliente de API diferencia erros HTTP de falhas de conexão e não adiciona `Content-Type` a GET sem corpo.
- A rota `/api/health` inclui `version: 0.9.3` e `Cache-Control: no-store`. O diagnóstico administrativo informa a versão publicada da API.
- O relatório financeiro do lojista usa leitura tolerante a campos de profissionais anteriores à v0.7 e sinaliza valores históricos ausentes, sem inventar comissões ou salários.
- Dependências de primeiro nível fixadas nos `package.json` para reduzir alterações inesperadas nas instalações. **Ainda é recomendado gerar e versionar o `package-lock.json` após uma instalação bem-sucedida.**
- Nenhum campo foi removido do esquema Prisma nesta versão. Não apague coleções e não sobrescreva o banco.

## B. FRONTEND — VERCEL

**Settings → Environment Variables → Production**

```env
API_INTERNAL_URL=https://vezora-61582772c979.herokuapp.com
```

É a única variável de aplicação necessária no frontend atual. URL base do backend, sem `/api` no final e sem `/` final. Salve e faça um novo deploy (config vars só entram no novo deployment).

Não adicione ao frontend: `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `MONGODB_URI`, `MP_CLIENT_SECRET`, `VEZORA_MP_ACCESS_TOKEN`, nem segredos de webhook.

## C. BACKEND — HEROKU

**Settings → Config Vars**, altere somente os valores que estiverem ausentes/errados. Exemplos abaixo são marcadores, **não** credenciais reais:

```env
MONGODB_URI=mongodb+srv://USUARIO:SENHA@SEU-CLUSTER.mongodb.net/vezora?retryWrites=true&w=majority
NODE_ENV=production
WEB_URL=https://vezora-agendamentos.vercel.app
API_PUBLIC_URL=https://vezora-61582772c979.herokuapp.com
JWT_SECRET=CHAVE_ALEATORIA_FORTE_COM_PELO_MENOS_32_CARACTERES
TOKEN_ENCRYPTION_KEY=64_CARACTERES_HEXADECIMAIS_ALEATORIOS
```

**Obrigatórias ao iniciar a API:** `MONGODB_URI` (com `/vezora`), `WEB_URL`, `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`. `NODE_ENV=production` é obrigatório operacionalmente para cookies `secure`, embora o schema de configuração tenha fallback. `API_PUBLIC_URL` pode estar ausente durante desenvolvimento, mas **é exigida para a geração de cobranças e webhooks em produção**.

`PORT` é injetada pelo Heroku. Não crie `PORT` manualmente. Não configure a mensalidade no Heroku; ela é definida no **painel superadministrador**, em Configurações, juntamente com os dias de teste.

### C1. Mercado Pago — mensalidades do Vezora, recebidas pela plataforma

```env
VEZORA_MP_ACCESS_TOKEN=TOKEN_DA_CONTA_VEZORA
VEZORA_MP_WEBHOOK_SECRET=SEGREDO_DO_WEBHOOK_ASSINATURAS
VEZORA_MP_COLLECTOR_ID=ID_DA_CONTA_RECEBEDORA
```

`VEZORA_MP_COLLECTOR_ID` é opcional, mas recomendado após conferir o valor na conta do Mercado Pago. As duas primeiras chaves e `API_PUBLIC_URL` são necessárias para ativar Pix e cartão na implementação atual.

Webhook da plataforma: `https://vezora-61582772c979.herokuapp.com/api/billing/webhook`. Eventos de pagamentos e de assinaturas recorrentes devem ser configurados no provedor conforme as capacidades da aplicação.

### C2. Mercado Pago — cada lojista recebe seu próprio sinal

```env
MP_CLIENT_ID=CLIENT_ID_DA_APLICACAO_MARKETPLACE
MP_CLIENT_SECRET=CLIENT_SECRET_DA_APLICACAO_MARKETPLACE
MP_REDIRECT_URI=https://vezora-61582772c979.herokuapp.com/api/payments/callback
MP_WEBHOOK_SECRET=SEGREDO_WEBHOOK_MARKETPLACE
```

O lojista conecta sua conta por OAuth: não precisa criar sua própria aplicação de desenvolvedor. Essa é a configuração de integração da plataforma Marketplace.

Webhook genérico: `https://vezora-61582772c979.herokuapp.com/api/payments/webhook`; a conciliação da reserva utiliza a URL individual fornecida durante a criação do pagamento (`/api/payments/webhook/:tenantId`).

**Importante:** não misture credenciais da aplicação de assinaturas com as de Marketplace. Faça a autorização OAuth em ambiente de teste e homologação antes de receber valores reais. Referência: https://www.mercadopago.com.br/developers/pt/docs/security/oauth/creation

## D. Ordem segura do deploy

1. Faça backup/snapshot do MongoDB Atlas antes de alterações e exportações em massa.
2. Faça deploy do **backend v0.9.3** no GitHub/Heroku, verificando o log do build.
3. Teste diretamente `https://vezora-61582772c979.herokuapp.com/api/health`: deverá conter `status: ok` e `version: 0.9.3`.
4. Se ainda existem documentos de profissionais antigos sem comissão/salário, execute **uma vez**, após backup: `heroku run npm run db:backfill-finance -a vezora`. O script adiciona campos ausentes sem sobrescrever valores existentes.
5. Faça deploy do **frontend v0.9.3** na Vercel. Confirme que o projeto tem **Root Directory** correta e `API_INTERNAL_URL` para Production.
6. Abra `https://vezora-agendamentos.vercel.app/api/health`: também deverá mostrar versão `0.9.3`.
7. Abra `/admin/diagnostico`, teste sessão, permissão SUPERADMIN, depois abra `/admin`.
8. Teste cadastro de lojista, serviços, profissionais, personalização, agendamento público, financeiro, geração de PDF, assinatura com Pix e fluxo OAuth em ambiente de testes.

**Esta atualização não altera o schema Prisma:** em instalações que já usam v0.9.2 corretamente, `db:push` não é necessário. Se estiver subindo de versão anterior, faça backup e confira os passos de migração da versão antiga.

## E. Painel branco no navegador normal, mas funcionando na guia anônima

Isso geralmente está relacionado a uma sessão antiga ou a dados/caches locais, porém só o Console confirma a causa. No Chrome:

1. Abra `https://vezora-agendamentos.vercel.app`.
2. Pressione F12 → **Application** → **Storage** → **Clear site data** para **esse domínio**, sem afetar outros sites.
3. Faça login novamente como administrador e entre em `/admin`.
4. Em vez de limpar manualmente, use **Limpar sessão e entrar** na tela administrativa se ela conseguir renderizar.
5. Se o erro persistir, consulte `/admin/diagnostico` e o **Console + Network** do Chrome. A rota HTTP 500 deve ser correlacionada com o log do Heroku.

## F. Segurança dos segredos

Os prints anteriores exibiram partes de credenciais. Antes do uso comercial, rotacione a senha do MongoDB, tokens do Mercado Pago, JWT e segredo de webhook; **não publique os valores em chats, PDFs ou GitHub**. Rotacionar `JWT_SECRET` exige novo login; rotacionar `TOKEN_ENCRYPTION_KEY` **invalida os tokens OAuth já criptografados**, portanto reconecte os lojistas ou planeje recriptografia antes da rotação. Nunca cole os valores reais no `.env.example`.

## G. Resultado da auditoria local e limites

- 47 arquivos `.ts/.tsx` analisados sintaticamente: sem erros de parsing.
- 5 cenários das regras de teste grátis/assinatura; 4 casos de comissão; 4 de assinatura HMAC; 6 verificações de integração estática: aprovados.
- `globals.css` analisado por parser: sem erros de sintaxe no nível da folha de estilos.
- Arquivos ZIP verificados na geração.
- **Não homologado** neste ambiente: `next build`, `tsc` com dependências instaladas, execução do servidor no Heroku, consultas reais ao MongoDB, autenticação no navegador e pagamentos Pix/cartão. A instalação npm ficou indisponível aqui. **Não considerar a v0.9.3 aprovada para produção financeira sem esses testes.**

A versão não modifica contratos de autenticação, valores de cobrança nem coleções existentes; são correções de estabilidade, compatibilidade e diagnóstico. Evite ativar cobranças de produção até a homologação end-to-end.
