# Vezora frontend 1.0.7

- Imagens da marca com upload direto, otimização local, visualização prévia, troca e remoção.
- Marca salva diretamente na API (`/api/tenant/media/logo` e `/api/tenant/media/cover`), sem links externos.
- As etapas de marca, serviço e profissionais retornam à Visão geral após salvar quando iniciadas no checklist.
- Guia de configuração desaparece definitivamente quando seis etapas são concluídas; conclusão sincronizada com o backend.
- Notificações podem ser ativadas em aparelhos novos mesmo com checklist já concluído.
- Rotas públicas de mídia com cache específico sem afetar respostas autenticadas.
