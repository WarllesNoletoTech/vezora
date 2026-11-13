# Vezora Backend v0.6.1 — correção TS2345 no Heroku

## Diagnóstico

O Heroku rejeitava o deploy com `TS2345` em `src/admin.ts:111`: o resultado de `prisma.tenant.findUnique()` é anulável, e o TypeScript não estreitava o tipo após a chamada de uma constante `fail` tipada como `never`.

## Mudança

A função `fail` passou de constante arrow para `function fail(...) : never`. Isso permite que o TypeScript reconheça a interrupção do fluxo de controle e trate `t` como não nulo após `if (!t) fail(404, ...)`. O comportamento HTTP 404 permanece igual. Nenhum dado ou esquema do MongoDB foi alterado.

## Deploy

1. Substitua o conteúdo do repositório `vezora-backend` por este ZIP (mantendo os arquivos na raiz do repositório).
2. Faça commit e push para o branch ligado ao Heroku.
3. Confira o novo build do Heroku.
4. Quando estiver publicado, execute `heroku run -a vezora npm run admin:promote -- --email SEU_EMAIL` com e-mail já cadastrado para conceder o papel de superadministrador.
5. Faça logout/login e visite `/admin`.

## Verificação

O erro foi reproduzido e a solução foi verificada com o compilador TypeScript global em um teste reduzido. A sintaxe de todos os arquivos TypeScript foi analisada. O build completo (`npm run build`) não foi executado neste ambiente porque o npm registry estava inacessível; o Heroku deverá confirmar a compilação completa.
