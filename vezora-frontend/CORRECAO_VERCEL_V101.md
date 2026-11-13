# Vezora Frontend 1.0.1 — Hotfix Vercel

## Erro corrigido

A Vercel recusava o build na página `/assinatura`:

```
Type error: Property 'view' does not exist on type 'ScriptProps'.
./app/assinatura/page.tsx:42
```

No script de segurança do Mercado Pago, `view="checkout"` é um atributo HTML específico do provedor, mas `next/script` não o inclui nos tipos. Ele agora é passado por propagação de um objeto tipado (`...mercadoPagoSecurityAttributes`), preservando o atributo `view="checkout"` no script em execução.

## Alterações

- `app/assinatura/page.tsx`: corrigida tipagem do componente `Script` mantendo o atributo do Mercado Pago.
- `package.json`: versão do frontend `1.0.1`.
- Não há alterações no backend, nas Config Vars ou no banco.

## Publicação

1. Atualize o repositório `vezora-frontend` no GitHub com este pacote.
2. Aguarde o deployment na Vercel e confirme que `Linting and checking validity of types` passa.
3. Abra `/assinatura` e verifique no DevTools que `security.js` foi carregado; confira no Network que nenhuma chamada foi bloqueada.
4. Faça um teste controlado de geração de Pix; não é necessário repetir pagamentos reais já aprovados.

## Validação local

A sintaxe do TSX e o padrão de propagação das props foram verificados. Não foi possível executar o `next build` neste ambiente porque o registro npm não estava acessível (EAI_AGAIN). O build na Vercel é a validação final.
