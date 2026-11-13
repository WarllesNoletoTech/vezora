# VEZORA v0.3 — correção Heroku + identidade visual + responsividade

Projetos independentes: `vezora-backend` (Node, Prisma, MongoDB no Heroku) e `vezora-frontend` (Next.js na Vercel).

## Diagnóstico dos prints de 12/11/2026

- Heroku: `H10 App crashed`, status 503. Não é erro de preenchimento do cadastro. O backend encerra durante a inicialização.
- No Heroku foi configurado `MONGODB_URI`, enquanto o Prisma e a validação anteriores exigiam `DATABASE_URL`. Corrigido para usar `MONGODB_URI` no Prisma e no backend.
- Faltava `API_PUBLIC_URL` no Heroku: a configuração anterior a exigia para iniciar mesmo sem Mercado Pago. Agora só é necessária para habilitar pagamentos.
- O `WEB_URL` do print terminava com `/`, o que impediria validação de `Origin`. A nova versão remove a barra final automaticamente.
- Na Vercel existem `API_INTERNAL_URL` e `API_PUBLIC_URL`. O frontend só precisa de `API_INTERNAL_URL`; `API_PUBLIC_URL` deve ficar no Heroku quando a integração financeira for usada.

**Atenção à segurança:** um dos prints mostra credenciais parcialmente visíveis. Troque a senha do usuário do MongoDB e rotacione os segredos JWT e de criptografia por novos valores privados; nunca envie esses segredos em prints ou commits.

## 1. Heroku — vezora-backend

- **Root do repositório:** a pasta que contém `package.json` e `Procfile` do `vezora-backend` deve ser a raiz publicada no Heroku (separar repos é o mais fácil).
- Variáveis (Config Vars):

```env
MONGODB_URI=mongodb+srv://USUARIO:SENHA@SEU_CLUSTER.mongodb.net/vezora?retryWrites=true&w=majority
NODE_ENV=production
WEB_URL=https://vezora-agendamentos.vercel.app
API_PUBLIC_URL=https://SEU-APP-BACKEND.herokuapp.com
JWT_SECRET=SEGREDO_PRIVADO_DE_32_OU_MAIS_CARACTERES
TOKEN_ENCRYPTION_KEY=SEGREDO_HEXADECIMAL_PRIVADO_DE_64_CARACTERES
```

`API_PUBLIC_URL` não precisa existir para cadastro e login, mas será necessária quando ativar Mercado Pago. Configure `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_REDIRECT_URI`, `MP_WEBHOOK_SECRET` quando habilitar recebimento de sinal.

A URL MongoDB deve ter **nome do banco** (`/vezora`). MongoDB Atlas precisa permitir conexões a partir do ambiente Heroku, e transações exigem replica set. Verifique usuário, senha (com caracteres especiais codificados em URL), Network Access e status do Atlas.

Após publicar:

```bash
heroku logs --tail -a NOME_REAL_DO_APP
heroku run npm run db:push -a NOME_REAL_DO_APP
```

Teste `https://SEU-APP-BACKEND.herokuapp.com/api/health`; deve devolver `{"status":"ok","name":"Vezora API"}`. Se ainda aparecer H10, os **primeiros logs do novo boot** mostrarão se falhou validação de Config Vars ou conexão ao banco.

## 2. Vercel — vezora-frontend

- Publique o repositório `vezora-frontend` ou defina **Root Directory** `vezora-frontend` num mono-repo.
- **Settings → Environment Variables → Production**:

```env
API_INTERNAL_URL=https://SEU-APP-BACKEND.herokuapp.com
```

Sem `/api` no final. Não coloque senha, JWT, MongoDB ou credenciais do Mercado Pago na Vercel. Depois das alterações, inicie um **Redeploy**.

Teste `https://vezora-agendamentos.vercel.app/api/health`:

- `200` JSON: frontend alcança a API.
- `503` JSON: `API_INTERNAL_URL` ausente/inválida na Vercel.
- `502` JSON: backend indisponível ou rota incorreta no Heroku.
- `404` HTML: versão antiga do frontend ou diretório raiz incorreto na Vercel.

## 3. Marca Vezora

Arquivos disponíveis em `vezora-frontend/public/`:

- `brand/vezora-symbol.svg` — símbolo em SVG.
- `brand/vezora-logo.svg`, `brand/vezora-logo-light.svg` — assinatura da marca.
- `favicon.ico`, `favicon-32x32.png` — favicons do navegador.
- `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — ícones para dispositivos.
- `og-vezora.png` — imagem para compartilhamentos.
- `app/manifest.ts` configura o manifesto de instalação para telas iniciais; uso offline **não foi implementado** nesta etapa.

## 4. Revisão de interface

- Mobile menu na página inicial; cabeçalho adaptado a telas pequenas.
- Formulários de cadastro/login com autofill, mostrar senha e link do estabelecimento mostrando o domínio atual.
- Responsividade refinada: página inicial, cadastro/login, painel, página pública de reservas e status.
- Sidebar mobile com botão acessível, bloqueio de rolagem do fundo; modais identificados como diálogo e fechamento pela tecla Escape.
- Mensagens mais claras para falha de consulta de horários; erro no agendamento conserva os dados preenchidos.
- Páginas de erro e não encontrado; título, descrição, ícones, Open Graph e manifesto.

## 5. Validação realizada / pendências

- Arquivos TypeScript/TSX: verificação de sintaxe com parser TypeScript.
- CSS: parser tinycss2 sem erros na folha de estilos.
- Smoke test de layout: HTML com a folha de estilos real renderizado no Chromium (320, 360, 390, 768 e 1280 px), sem rolagem horizontal nas telas de cadastro, landing, painel e reservas.
- **Não foi possível instalar as dependências npm** devido a DNS indisponível no ambiente; portanto não há garantia de build Next.js/TypeScript/Prisma nem teste integrado com MongoDB e Heroku. Faça o build nos deploys e envie os logs se houver erro.
- A conexão OAuth/Checkout Mercado Pago precisa ser homologada com credenciais de teste antes de operar com pagamentos reais.

