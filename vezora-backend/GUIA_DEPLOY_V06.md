# Vezora v0.6 — Painel de superadministrador e cadastro com WhatsApp

> Entrega separada para Vercel (`vezora-frontend`) e Heroku/MongoDB (`vezora-backend`).
> Esta é uma atualização de código para validação antes da produção: o ambiente de construção não permitiu instalar dependências npm e validar o build integral ou pagamentos reais.

## Novidades

- Painel `/admin` com autenticação de superadministrador verificada no banco a cada operação.
- Mensalidade do Vezora configurada no painel em **Configurações**, persistida no documento `PlatformSettings` no MongoDB. A variável `VEZORA_MONTHLY_PRICE_CENTS` foi **removida**.
- Indicadores: estabelecimentos, assinaturas ativas, testes, receitas Pix confirmadas (total e últimos 30 dias), agendamentos e distribuição por segmento.
- Gerenciamento de lojistas e estabelecimentos com busca, paginação, categoria, WhatsApp e histórico de cobranças.
- Ações auditadas: suspender/reativar, estender teste, conceder dias de acesso e corrigir telefone do usuário.
- Relatório de cobranças Pix, situação financeira e log de auditoria.
- Telefone/WhatsApp do proprietário **obrigatório** no novo cadastro; cadastros anteriores sem telefone ou categoria são enviados à atualização obrigatória no próximo login.
- Teste grátis de 3 dias, extensão manual de teste e bloqueio após prazo inalterados.

## 1. Atualizar os dois repositórios GitHub

**Backend (Heroku):** extraia `vezora-backend-v0.6-admin.zip` e envie o **conteúdo de `vezora-backend/`** para a raiz de seu repositório de backend (não coloque uma pasta aninhada adicional se a raiz já é o backend).

**Frontend (Vercel):** extraia `vezora-frontend-v0.6-admin.zip` e envie o conteúdo de `vezora-frontend/` para o repositório frontend.

Faça backup do banco MongoDB Atlas antes de sincronizar o esquema. Não remova os documentos antigos.

## 2. Variáveis de ambiente

### Heroku — BACKEND

```env
MONGODB_URI=mongodb+srv://USUARIO:SENHA@CLUSTER.mongodb.net/vezora?retryWrites=true&w=majority
NODE_ENV=production
WEB_URL=https://vezora-agendamentos.vercel.app
API_PUBLIC_URL=https://vezora-61582772c979.herokuapp.com
JWT_SECRET=SUA_CHAVE_LONGA_E_PRIVADA
TOKEN_ENCRYPTION_KEY=SUA_CHAVE_PRIVADA_COM_64_CARACTERES_HEXADECIMAIS
```

**Assinaturas Pix do Vezora** (somente quando ativar cobrança real):

```env
VEZORA_MP_ACCESS_TOKEN=TOKEN_DE_PRODUCAO_DA_CONTA_DA_PLATAFORMA
VEZORA_MP_WEBHOOK_SECRET=SEGREDO_DE_ASSINATURA_WEBHOOK
VEZORA_MP_COLLECTOR_ID=ID_DA_CONTA_RECEBEDORA_OPCIONAL
```

**Sinais de agendamento dos lojistas** (separados das assinaturas):

```env
MP_CLIENT_ID=
MP_CLIENT_SECRET=
MP_REDIRECT_URI=https://vezora-61582772c979.herokuapp.com/api/payments/callback
MP_WEBHOOK_SECRET=
```

**NÃO cadastre `VEZORA_MONTHLY_PRICE_CENTS`.** O valor é definido no painel. Heroku fornece `PORT` automaticamente.

### Vercel — FRONTEND

```env
API_INTERNAL_URL=https://vezora-61582772c979.herokuapp.com
```

Esta é a variável de integração necessária no frontend. Não passe ao frontend segredos JWT, MongoDB ou Mercado Pago. Faça redeploy após editar as variáveis.

## 3. Sincronizar MongoDB com segurança

Após publicar o backend, faça backup antes de alterar a estrutura e execute no terminal Heroku CLI:

```bash
heroku run npm run db:push -a vezora
```

Esse comando sincroniza os campos `User.phone`, `User.role`, `Tenant.trialExtensionDays`, `Tenant.suspendedAt`, `Tenant.suspensionReason` e as novas coleções `PlatformSettings`, `AdminAuditLog`. Os campos adicionados a usuários/estabelecimentos antigos são opcionais para que a aplicação continue lendo documentos legados. Não use `--accept-data-loss` e não apague o banco.

## 4. Ativar o primeiro superadministrador

**Atenção:** nenhuma pessoa pode se cadastrar como administrador pelo formulário público. A promoção precisa ser executada no servidor por alguém com permissão de deploy no Heroku.

Crie uma conta normal pelo site **com um e-mail exclusivo para sua administração** (de preferência, diferente do e-mail de qualquer lojista). Depois execute:

```bash
heroku run -a vezora npm run admin:promote -- --email SEU_EMAIL_DE_ADMIN
```

Substitua pelo e-mail exato da conta registrada. O script verifica se a conta existe, grava `SUPERADMIN` no MongoDB e registra a promoção no histórico de auditoria. Não aceita senha, role nem token passados pelo navegador.

Faça logout, entre novamente e acesse:

`https://vezora-agendamentos.vercel.app/admin`

**Importante:** se promover um usuário que já administra um estabelecimento, essa conta passa a abrir o painel de superadministrador em vez do painel do lojista. Recomendamos conta administrativa separada.

## 5. Definir preço mensal no painel (sem variável)

No painel `/admin` entre em **Configurações > Mensalidade dos lojistas**, informe por exemplo **39,90** e clique em **Salvar mensalidade**. O banco salva `3990` centavos.

- `0,00` desativa a **emissão de novos Pix**.
- Um Pix pendente emitido antes da alteração mantém o preço antigo.
- Uma assinatura paga mantém seu vencimento atual.
- As receitas do dashboard usam **apenas pagamentos Pix efetivamente confirmados** pelo webhook/API do Mercado Pago.
- Concessão manual de dias de acesso **não lança receita** e exige justificativa.
- A cobrança ficará indisponível até que os segredos do Mercado Pago da plataforma estejam configurados e homologados.

## 6. Checklist de homologação

1. Testar `https://vezora-agendamentos.vercel.app/api/health` e o mesmo endpoint direto no backend.
2. Cadastrar um novo lojista com **nome, WhatsApp, segmento, estabelecimento, link, e-mail, senha**.
3. Entrar com um usuário antigo sem telefone: exigir atualização no próximo login, preservando os dados.
4. Promover um usuário exclusivo via CLI e validar que somente ele entra em `/admin`.
5. Ajustar mensalidade no painel e confirmar que `/api/billing/status` mostra o valor atualizado.
6. Confirmar que não há rota pública para elevar role, alterar preço ou conceder acesso.
7. Suspender estabelecimento de teste: bloquear agenda pública e acesso; reativar.
8. Estender período de teste e conceder acesso, confirmando auditoria e ausência de receita fictícia.
9. Gerar Pix de assinatura em ambiente de homologação: conferir conta recebedora, valor e renovação após aprovação; testar reenvio/duplicidade de webhook.
10. Validar cadastro, login, preços, paginação, busca, WhatsApp, fluxo de reserva e estilos em celular real.

### Observações de segurança

- Segredos `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`, conexão MongoDB e tokens Mercado Pago ficam **somente no Heroku**.
- Imagens/prints com segredos expostos exigem rotação das credenciais.
- O comando de promoção é um procedimento operacional de alto privilégio: use exclusivamente sua conta e não compartilhe acesso ao Heroku.
- Não execute transações reais antes da homologação de pagamentos.

## 7. Testes feitos nesta entrega

- Verificação de **sintaxe** dos arquivos TypeScript/TSX via transpiler TypeScript: aprovada.
- Testes puros locais para estados de teste, expiração, extensão, assinatura e suspensão: aprovados.
- Parse de sintaxe CSS: aprovado.
- Instalação de dependências npm **indisponível** neste ambiente (pacotes não estão no cache e registro não é acessível); compilação real Next.js e `prisma generate` não executados.
- Teste visual automatizado em Chromium **não concluído** por timeout. Validar responsividade no deploy.
- Integração real com MongoDB Atlas, Heroku e Mercado Pago **não foi executada** por falta de credenciais/ambiente conectado.
