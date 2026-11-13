# Vezora v0.9.6 — correção de proprietário órfão

## Diagnóstico confirmado no Heroku
`PrismaClientUnknownRequestError: Inconsistent query result: Field owner is required to return data, got null instead.`

Um ou mais estabelecimentos possuem `ownerId` sem um usuário correspondente em `User`.

## Mudanças
- As consultas administrativas de Estabelecimentos, Detalhes, Exportação CSV, Pagamentos e Financeiro geral não fazem mais `include/select` do relacionamento obrigatório `owner` diretamente. Buscam os usuários por IDs separadamente.
- Estabelecimento órfão permanece visível com `ownerMissing: true` e proprietário `Proprietário não localizado`.
- Nenhuma mudança no esquema Prisma ou dados MongoDB. Sem `db:push`.
- Diagnóstico de vínculos: `npm run db:audit-owners` (somente leitura).
- Não são criados usuários falsos nem reatribuída a titularidade automaticamente.

## Implantação
1. Backup do MongoDB Atlas (recomendado antes de qualquer manutenção).
2. Atualizar **apenas o backend** no Heroku e confirmar o build.
3. No console Heroku executar `npm run db:audit-owners`.
4. Verificar `https://vezora-agendamentos.vercel.app/admin/diagnostico` e as telas Estabelecimentos e Financeiro geral.
5. Avaliar individualmente os tenants marcados como sem proprietário, conferindo dados de cadastro e histórico. Para vinculação correta, procedimento controlado após confirmação de titularidade.

## Observações
- Esta atualização corrige especificamente a falha de relação `owner` comprovada pelos logs. Outros erros de banco ou de pagamento podem precisar de investigação própria.
- O frontend atual não requer atualização. Nenhum segredo ou variável nova de ambiente.
- A compilação e as queries com MongoDB Atlas real devem ser verificadas no deploy.
