# vezora-frontend — Vezora (Next.js 15 / Vercel)

Frontend independente para o Vezora. **Não precisa de MongoDB no Vercel.** O frontend chama a API Node/Express no Heroku.

## Localmente

1. `npm install`
2. Copie `.env.example` para `.env.local` e configure `API_INTERNAL_URL=http://localhost:4000`.
3. `npm run dev` — abra http://localhost:3000.

## Deploy na Vercel

1. Importe o repositório `vezora-frontend` no Vercel (Root Directory: `.`).
2. Configure **`API_INTERNAL_URL=https://SEU-BACK.herokuapp.com`** em Environment Variables (sem `/` final). Esta variável é avaliada na configuração do Next.js durante o build. Não precisa expor a URL em `NEXT_PUBLIC_*`.
3. Publique e, no backend Heroku, defina `WEB_URL=https://SEU-FRONT.vercel.app` (origem exata).
4. Se alterar `API_INTERNAL_URL`, faça novo deploy do frontend.

O arquivo `next.config.mjs` encaminha `/api/:path*` para o Heroku; assim a sessão HTTP-only usa a origem do próprio site. Evite mudar o domínio frontend sem alterar `WEB_URL` no backend.

## Integração de pagamentos

OAuth Mercado Pago e webhooks ficam somente no `vezora-backend`; nunca coloque tokens de lojista no frontend. O cliente visualiza o Checkout Pro em um URL oficial do Mercado Pago. Antes de cobrar em produção, validar os fluxos em homologação.
