# Vezora v0.8 — Painel de superadministrador, desempenho e relatórios

## Entregas

### Backend `vezora-backend`
- `GET /api/admin/finance/summary?from=YYYY-MM-DD&to=YYYY-MM-DD[&tenantId=ID]`
- `GET /api/admin/finance/report.pdf?...` — PDF de uso interno, com logo e identificação da plataforma
- `GET /api/admin/finance/export.csv?...` — CSV seguro contra injeção de fórmulas
- Dados agregados por estabelecimento, separados de assinaturas recebidas pela plataforma
- Permissão `SUPERADMIN` validada no banco a cada chamada; o cadastro público não concede este perfil
- Sem mudanças de esquema Prisma e sem migração necessária para esta versão

### Frontend `vezora-frontend`
- Nova aba **Financeiro geral** com filtros de datas e estabelecimento
- Produção concluída, recebido, pendente, comissões, salários cadastrados e receita das assinaturas
- Ranking das lojas na visão geral; links de WhatsApp na tabela de estabelecimentos e de faturamento
- PDF/CSV por período e por estabelecimento
- Possibilidade de abrir o financeiro diretamente pelo detalhamento de um estabelecimento
- `app/admin/error.tsx` e carregamento de erro de sessão para evitar tela em branco sem explicação

## Definições contábeis
- **Produção concluída:** soma dos preços de serviços com agendamento concluído na data do atendimento.
- **Recebimentos dos lojistas:** sinal aprovado + recebimentos manuais informados na plataforma para serviços concluídos no período. Não representa extrato bancário validado.
- **Saldo pendente:** valor dos serviços concluídos ainda não registrado como recebido.
- **Comissões previstas:** calculadas pelas configurações congeladas no agendamento quando disponíveis; não comprovam repasses.
- **Salários mensais cadastrados:** valor contratual de referência, não despesa comprovada no período e não somado aos custos financeiros.
- **Assinaturas do Vezora:** pagamentos `PAID` com `paidAt` no período. Não misturar com faturamento dos lojistas.
- **Legado:** preços e comissões sem histórico congelado usam cadastro atual; relatórios sinalizam esses registros.
- Período administrativo usado: **America/Sao_Paulo** (horário de Brasília), em dias completos.
- Consulta limitada a 366 dias e 12.000 reservas, para evitar erros por relatórios parciais; solicita divisão do período ou seleção de loja quando o limite é atingido.

## Deploy
1. Fazer backup do MongoDB Atlas.
2. Atualizar o repositório `vezora-backend` com o ZIP do backend e fazer deploy no Heroku.
3. Atualizar o repositório `vezora-frontend` com o ZIP do frontend e fazer deploy na Vercel.
4. Configurar `API_INTERNAL_URL` na Vercel apontando para o domínio HTTPS do backend.
5. Manter `MONGODB_URI`, `WEB_URL`, `API_PUBLIC_URL`, `JWT_SECRET` e `TOKEN_ENCRYPTION_KEY` no Heroku.
6. **Não é necessário `db:push` para a v0.8** (schema Prisma sem alterações).
7. Entrar novamente como `SUPERADMIN` e acessar `/admin`. Conferir as abas Visão geral, Estabelecimentos, Lojistas, Financeiro geral, Cobranças, Configurações e Auditoria.
8. Testar `PDF`, `CSV`, WhatsApp e filtros com dados reais de uma loja.

## Diagnóstico de página branca
- A v0.8 adiciona uma página de erro e retorno explícito quando a autenticação falha, mas **não é possível garantir a causa da página branca apenas pelo print**.
- Se ainda ocorrer, abrir **F12 → Console** e **Network**, copiar as mensagens de erro (sem tokens ou senhas), e verificar `/api/me` e `/api/admin/summary`.
- `GET /api/health` com status 200 verifica somente a API, não garante que permissões e consultas administrativas estão corretas.

## Segurança
- `SUPERADMIN` no backend protege todos os endpoints de administração.
- Links de WhatsApp são manuais; não há disparo automático de mensagens.
- PDF e CSV usam endpoints autenticados, com respostas `private, no-store`.
- Não colocar chaves do Mercado Pago nem JWT no frontend ou em repositórios públicos.

## Testes pendentes
As verificações de sintaxe foram feitas neste ambiente. **Build completo com dependências e testes ponta a ponta no Heroku/MongoDB/Vercel ainda precisam ser executados** antes do lançamento.
