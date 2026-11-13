# vezora-frontend — Vezora (Next.js 15 / Vercel)

Projeto independente para Vercel. O backend e o MongoDB ficam no Heroku/Atlas.

## CORRECAO DO ERRO 404 NO CADASTRO

O formulario chama `POST /api/auth/register`. Esta rota existe no backend.
Esta versao implementa `app/api/[...path]/route.ts`, um proxy dinamico
que devolve JSON com instrucoes quando `API_INTERNAL_URL` estiver ausente
ou o Heroku estiver fora do ar. Nao depende mais de rewrites no `next.config`.

### Configurar na Vercel

1. Em **Settings > Environment Variables** no projeto do FRONTEND:
   - Key: `API_INTERNAL_URL`
   - Value: `https://NOME-REAL-DO-BACKEND.herokuapp.com`
   - Environments: **Production** (e Preview, se for testar previews).
   - **Nao** adicione `/api`, `/auth`, `/api/health`, aspas ou barra final.
2. No Heroku do backend, configure `WEB_URL=https://vezora-agendamentos.vercel.app`
   (ou sua URL publica exata, sem barra final).
3. Na Vercel, faca **Redeploy** da versao atualizada com o codigo do proxy.
4. Abra `https://vezora-agendamentos.vercel.app/api/health`.
   - `200` com `status:ok`: frontend encaminha ao backend corretamente.
   - `503` JSON: variavel `API_INTERNAL_URL` ausente ou invalida.
   - `502` JSON: Heroku inacessivel ou rota inexistente no backend.
   - `404` HTML: frontend publicado ainda NAO inclui este proxy, ou root dir incorreto.
5. Se `200`, tente `/cadastro` novamente. Se `403`, verifique `WEB_URL` no Heroku.

**Atencao:** Se o seu repositorio GitHub contem `vezora-frontend/` e
`vezora-backend/` juntos, configure **Root Directory = `vezora-frontend`**
no projeto Vercel. Para Heroku, publique a pasta `vezora-backend` como raiz
em outro repositorio ou pipeline de deploy. O Heroku conectado diretamente a um
repositorio com as duas pastas NAO encontra o `package.json` do backend na raiz.

### Rodar localmente

```sh
npm install
cp .env.example .env.local
npm run dev
```

Configure `API_INTERNAL_URL=http://localhost:4000`. Abra http://localhost:3000.

### Pagamentos

OAuth e webhooks ficam exclusivamente no backend. Nao inclua as chaves
JWT_SECRET, TOKEN_ENCRYPTION_KEY nem dados do Mercado Pago na Vercel.


## Novidades da v0.3
Nova marca Vezora (`public/`), navegação mobile, melhorias de responsividade nas telas de cadastro, painel e reservas, mensagens de erro e SEO/manifest. Consulte `README_DEPLOY.md`.

## Atualização v0.5
Consulte `GUIA_ATUALIZACAO_V05.md` para personalização por segmento e assinatura Pix.
