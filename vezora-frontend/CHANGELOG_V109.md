# Vezora v1.0.9 — Cadastros, dados isolados e WhatsApp

## Alterações de segurança
- Cadastro: normaliza e-mail para minúsculas; verifica duplicatas ignorando caixa, com mensagem 409 e índice único existente.
- Login: não seleciona arbitrariamente contas antigas com e-mails duplicados.
- Sessões: JWT de uma conta apagada/arquivada não autoriza mais acesso.
- Isolamento: consulta do lojista usa ownerId (nunca o e-mail) e reservas listadas só incluem serviços e profissionais do mesmo estabelecimento.
- Auditoria (somente leitura): verifica proprietários ausentes, duplicatas por caixa e reservas com vínculos cruzados.
- Arquivamento do estabelecimento: **não apaga histórico financeiro**; marca tenant e proprietário como arquivados, invalida a conta antiga, libera e-mail/slug para novo cadastro, remove credenciais OAuth do lojista e registra auditoria. É bloqueado se existirem pagamentos/assinaturas ou reservas pendentes em conciliação.
- O retorno público das reservas e a mídia de marca não expõem estabelecimentos arquivados.

## WhatsApp
O painel da lojista passa a oferecer links manuais, com textos diferentes para: sinal pendente, sinal confirmado, lembrete de atendimento, pagamento em análise, cancelamento/expiração e agradecimento.
- O texto de *sinal pago* só aparece quando o backend registra depositPaidAt.
- O link de checkout não é enviado se estiver vencido.
- **Nenhuma mensagem é enviada automaticamente**. Cada link abre o WhatsApp e a lojista decide enviar; a API oficial do WhatsApp seria necessária para automação.

## Publicação (backend no Heroku / frontend na Vercel)
1. Faça backup do MongoDB. Não resete nem apague coleções.
2. Publique primeiro a branch v1.0.9 do backend.
3. Execute no Heroku: `heroku run -a vezora npm run db:push` (ou use o console e `npm run db:push`). Campos novos são opcionais e não exigem preenchimento retroativo.
4. Execute: `heroku run -a vezora npm run db:audit-owners`. Se aparecerem inconsistências, inspecione os IDs **sem vincular usuários automaticamente pelo e-mail**.
5. Publique o frontend v1.0.9 na Vercel.
6. Teste: cadastro duplicado com mesmo e-mail em caixa diferente → 409; nova conta → tenant novo; abrir links WhatsApp de reservas com e sem sinal; arquivamento somente em conta de teste, conferindo bloqueio de login.

## Atenção
Arquivar exige confirmação exata do slug e motivo. Não há desfazer automático; preserve histórico e backups. Contas com cobranças pendentes ou cartão recorrente ativo não podem ser arquivadas. Nenhuma credencial adicional é necessária.

A compilação e a homologação de produção devem ser validadas nos deploys; os testes sem banco do WhatsApp foram executados localmente.
