# Vezora v1.0.6 — hotfix OneSignal (Vercel)

Corrigido erro TS2339 em `components/PushSetup.tsx`: o tipo local `OneSignalClient.User.PushSubscription` não declarava `addEventListener` e `removeEventListener` presentes no SDK Web v16.

Nenhuma alteração no backend, banco ou credenciais.

## Publicação
1. Substituir a pasta do frontend no repositório `vezora-frontend`, ou somente `components/PushSetup.tsx`.
2. Publicar novamente na Vercel.
3. Confirmar compilação e validar no navegador: ativar notificações, enviar teste e marcar recebimento após a notificação aparecer.

**Nota:** neste ambiente não há as dependências npm do projeto; a verificação de tipos completa e o build Next.js precisam ser confirmados na Vercel.
