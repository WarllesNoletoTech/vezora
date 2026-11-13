# Vezora frontend 1.0.5 — Instalação PWA

- Botão principal **Instalar Vezora** sempre visível no modal de boas-vindas após o cadastro.
- Quando `beforeinstallprompt` está disponível, o botão abre o prompt nativo do navegador.
- Quando não está, o mesmo botão mostra instruções específicas para Android, iPhone/iPad e computador, sem prometer instalação automática.
- Listener instalado antecipadamente no layout, antes da hidratação React, evitando perder o evento no primeiro carregamento.
- Evita reapresentar a instalação no modo standalone; respeita o gesto e a decisão do usuário.
- Backend, OneSignal, pagamentos e tema dos estabelecimentos não foram alterados.

## Publicação

Publique **somente o frontend** no Vercel a partir do conteúdo da pasta `vezora-frontend`. Nenhuma variável ou migração de banco nova é necessária.

Teste no Chrome de Android/desktop via HTTPS. Caso o navegador não emita `beforeinstallprompt`, o botão exibirá o passo a passo. Isso é uma limitação do navegador e não pode ser forçado pelo site.
