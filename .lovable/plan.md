# Diagnóstico

O screenshot confirma cache stale do app desktop Lovable:
- "PE Love" aparece como texto (fallback do `alt`) → `logo-pelove.png` não carregou → bundle anterior à Fase 1.
- Falta item "Vida" e os itens `adminOnly` aparecem todos sem filtro novo.

O código no repo já está correto (`src/components/AppSidebar.tsx` linhas 22-31). O problema é puramente entrega: o desktop está rodando um snapshot antigo + service worker `autoUpdate` antigo que não ativa enquanto janela permanece aberta.

# Passos

1. **Bump de cache em `index.html`** — trocar `<meta name="build-version" content="fase1-vida-v1" />` para `fase1-vida-v2` (ou similar). Garante novo hash do HTML.

2. **Publicar** o projeto pela UI do Lovable. Isso é necessário porque o app desktop serve a "saved version", não o dev preview.

3. **Validação no desktop após publish**:
   - Fechar TODAS as janelas do app desktop Lovable.
   - Reabrir → deve carregar a build nova com Vida + logo + sidebar filtrada.
   - A partir daí, o novo `PWAUpdatePrompt` (registerType: prompt + check a cada 60s) passa a funcionar pros publishes seguintes — o banner "Nova versão disponível" aparecerá sem precisar fechar.

4. **Se ainda não atualizar após reabrir**: limpar manualmente cache do Electron via DevTools do app desktop (Cmd+Opt+I → Application → Clear storage → Clear site data) — só uma vez, pra escapar do SW antigo `autoUpdate` que ainda está controlando o cliente.

# Por que precisa de um publish "ponte"

A nova estratégia `registerType: "prompt"` só é entregue ao cliente quando ele baixar uma build que **contenha** essa nova estratégia. O SW antigo (`autoUpdate`) controla o cliente até ser substituído. O primeiro publish após a mudança é essa ponte — depois dele, futuros updates aparecem como banner.

# O que NÃO mudar

- Não mexer em `AppSidebar.tsx`, `App.tsx`, ou roles — código já correto.
- Não refactor de PWA — implementação já feita na mensagem anterior.
