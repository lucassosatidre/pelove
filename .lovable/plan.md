# Diagnóstico

O problema persistiu porque o PWA anterior gerou um service worker que continuava controlando o app desktop e servindo um shell antigo em cache. Trocar para `registerType: "prompt"` não resolve clientes que ainda estão presos no worker antigo, porque eles precisam primeiro baixar uma build nova para receber a lógica do prompt.

# Correção definitiva

1. Remover `vite-plugin-pwa` da build para não gerar novos service workers.
2. Publicar workers estáticos de limpeza em `/sw.js` e `/service-worker.js` para substituir o worker antigo, limpar todos os caches, navegar os clientes com `sw-cleanup` e se desregistrar.
3. Adicionar uma limpeza defensiva no boot da aplicação para desregistrar qualquer service worker remanescente depois que o app carregar.
4. Bump de `build-version` para forçar novo HTML.

# Resultado esperado

Após publicar esta versão, o app desktop deve sair do snapshot antigo, carregar a sidebar atual com logo e Vida, e parar de ficar preso em caches PWA antigos nos próximos publishes.
