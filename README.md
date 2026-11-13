# Vezora — correção de cadastro 404 (v0.2.1)

Este repositório contém **dois projetos independentes**:

- `vezora-frontend/` — Next.js 15 (Vercel)
- `vezora-backend/` — Node/Express/Prisma 6 + MongoDB (Heroku)

## Correção aplicada

O formulário faz `POST /api/auth/register` no próprio domínio da Vercel.
O frontend agora possui um proxy em `vezora-frontend/app/api/[...path]/route.ts`,
que encaminha a chamada ao Heroku usando `API_INTERNAL_URL` em tempo de execução.
Isso substitui a regra de rewrite anterior e oferece mensagens JSON úteis em caso
de falta de variável ou indisponibilidade do backend.

## Verificações obrigatórias no deploy

### Vercel (frontend)

- **Root Directory:** `vezora-frontend` (se utilizar o repositório combinado)
- **Environment Variable:** `API_INTERNAL_URL=https://SEU-BACKEND.herokuapp.com`
- **Environment:** Production
- Republicar o frontend depois de enviar os arquivos alterados.

### Heroku (backend)

- Implantar `vezora-backend/` como raiz de repositório separado (ou configurar a
  ferramenta/pipeline de build para usar essa pasta; o deploy padrão de repositório
  misto não detecta `package.json` no diretório raiz).
- `WEB_URL=https://vezora-agendamentos.vercel.app`
- `API_PUBLIC_URL=https://SEU-BACKEND.herokuapp.com`
- `DATABASE_URL=mongodb+srv://...` com rede do Atlas permitindo conexão.
- `JWT_SECRET` e `TOKEN_ENCRYPTION_KEY` configurados; `NODE_ENV=production`.
- Após deploy, `heroku run npm run db:push -a SEU-APP-BACKEND` para índices.

### Teste sem credenciais

1. `https://SEU-BACKEND.herokuapp.com/api/health` -> 200 JSON.
2. `https://vezora-agendamentos.vercel.app/api/health` -> mesmo 200 JSON.
3. Abra `/cadastro` e tente cadastrar.

Se a etapa 1 falha, verificar logs do Heroku e MongoDB. Se a etapa 1 funciona
mas 2 falha, verificar variável Vercel / Root Directory e rede.

`503`: frontend sem `API_INTERNAL_URL`; `502`: Heroku indisponível ou com rota
errada; `403`: diferença de domínio em `WEB_URL`; `409`: nome, e-mail ou slug
já registrados; `404 HTML`: frontend antigo ou projeto Vercel apontando para
outra raiz. **Não copie segredos para o frontend**.

O código passou por verificação sintática, e o proxy passou em seis cenários
simulados. O build integral com `npm install` e um cadastro real dependem do
ambiente de deploy, pois o ambiente de execução não obteve pacotes npm.
