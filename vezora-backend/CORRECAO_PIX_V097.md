# Vezora Backend v0.9.7 — Pix da assinatura

Correção localizada sobre a v0.9.6 (mantém todo o backend).

## Alterações

- Vencimento do Pix ajustado para 45 minutos e sincronizado com a cobrança local. Antes era definido exatamente em 30 minutos, o mínimo da API, podendo chegar ao Mercado Pago ligeiramente abaixo do limite.
- Se existir cobrança pendente sem QR Code com menos de 31 minutos restantes, o backend emite um novo registro, em vez de reutilizar um vencimento curto.
- Logs de falhas da API do Mercado Pago incluem o HTTP status e códigos de erro do provedor, sem registrar Access Token, CPF, e-mail ou conteúdo bruto da cobrança.

## Publicação

Atualize **somente o backend no Heroku**, sem alterar frontend, MongoDB ou variáveis. Não é necessário db:push.

Após o deploy, tente gerar um Pix. Se falhar novamente, consulte `heroku logs --tail -a vezora` e procure `Mercado Pago plataforma HTTP` seguido do status (400, 401, 403 etc.) e causeCodes. O código confirma uma causa potencial no Vezora, mas não substitui a inspeção do erro devolvido pelo Mercado Pago.

Verifique se as credenciais da aplicação Assinaturas correspondem ao ambiente de teste/produção que você pretende usar e se a conta possui chave Pix.
