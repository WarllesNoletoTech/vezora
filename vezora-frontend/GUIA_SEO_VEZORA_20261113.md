# Vezora — SEO técnico e comercial (13/11/2026)

## Entregas
- Página pública dos lojistas agora é renderizada com dados do backend no servidor (HTML inicial), mantendo o agendamento interativo.
- Metadata individual: title, description, canonical, Open Graph/Twitter e imagens da capa quando disponível.
- Dados estruturados schema.org (HairSalon, BeautySalon ou LocalBusiness conforme atividade); serviços reais, sem avaliações inventadas.
- URL `/sitemap.xml`: página inicial, 5 páginas comerciais e lojistas ativos com serviços cadastrados.
- URL `/robots.txt`: regras para crawler, endpoint do sitemap e proteção de rotas de API/reservas.
- `noindex`: painéis, administração, assinatura, autenticação, atualização de cadastro e reservas individuais.
- Cinco páginas comerciais com conteúdo próprio: barbearias, nail designers, lash designers, salões e Pix.
- Links internos das páginas comerciais na página inicial.
- Nenhuma configuração de pagamentos, dados financeiros, checkout ou autenticação foi alterada.

## Ordem de deploy
1. Faça backup de produção, como boa prática operacional. Não é necessária migração do MongoDB.
2. Publique **backend primeiro**; precisa expor `GET /api/seo/tenants?page=1`.
3. Confirme resposta do endpoint com `tenants` e `hasMore` (sem dados pessoais).
4. Publique o frontend na Vercel, mantendo `API_INTERNAL_URL` com a URL HTTPS do Heroku, SEM /api.
5. Abra `https://vezora-agendamentos.vercel.app/robots.txt` e `/sitemap.xml`.
6. Abra uma página de lojista ativa; inspecione **Exibir código-fonte da página** para ver nome, descrição, serviços e JSON-LD. Em uma loja suspensa/expirada, confira `noindex`.
7. Abra `/solucoes/agendamento-para-barbearias` e teste os links da home.
8. Valide `/painel` e `/admin` sem indexação; teste reservas e Mercado Pago como antes.
9. Cadastre o domínio do Vezora no Google Search Console e envie `https://vezora-agendamentos.vercel.app/sitemap.xml`.
10. Use o Rich Results Test e o PageSpeed Insights em URLs públicas.

## Observações
- Só estão no sitemap estabelecimentos não arquivados, com teste/assinatura vigente e pelo menos um serviço ativo.
- A página pública de estabelecimento fora do período ativo continua acessível com aviso, mas recebe `noindex`.
- Se o backend estiver indisponível, a geração do sitemap ainda lista a home e as páginas comerciais, registrando o erro nos logs; os lojistas entram na próxima revalidação.
- Não é garantida posição nos resultados de busca. Não foram criadas avaliações falsas.
- Para usar um domínio personalizado futuro, ajuste o SITE_URL nos arquivos de SEO do frontend e o cadastro no Search Console.
