# Vezora Frontend v1.0.6

- Checklist ampliado de cinco para seis passos, incluindo **Ative e teste as notificações**.
- Lojista pode ativar OneSignal e solicitar um teste; só marca concluído após confirmar que o aviso chegou ao dispositivo.
- Permissão e inscrição push verificadas; teste não é marcado apenas porque a API aceitou a requisição.
- A instalação PWA é reoferecida em outro acesso (intervalo de 24h) se não tiver sido identificada.
- O aviso deixa de aparecer em modo standalone ou após o evento `appinstalled`. Se o navegador voltar a oferecer a instalação, a marcação anterior é revista.
- Backend e banco de dados sem alterações.
