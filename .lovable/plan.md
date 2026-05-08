## Problema

No mapa estratégico (`MindMapLayout`), quando você cria um novo obstáculo, ele não tem nenhuma ação ainda. Por causa disso:

1. O chevron de expandir/colapsar do obstáculo só aparece se `obstacle.actions.length > 0` (em `SortableObstacleCard`). Obstáculo novo = sem chevron.
2. A área de ações — onde mora o botão **"+ Ação"** que adiciona a cadeia de balões (Ação, Resultado esperado, Entregável, Responsável, Prazo, Status) — só é renderizada quando o obstáculo está expandido (`obsExpanded && (...)`).

Resultado: obstáculo novo fica sem chevron e sem botão "+ Ação", então não há como adicionar os balões.

## Correção (apenas UI em `src/components/mapa/MindMapLayout.tsx`)

1. **Mostrar o chevron sempre** em `SortableObstacleCard` (remover a condição `obstacle.actions.length > 0` que esconde o botão de toggle).
2. **Renderizar a área de ações sempre que o obstáculo estiver expandido**, mesmo com `actions.length === 0`, para que o botão "+ Ação" apareça.
3. **Auto-expandir obstáculo recém-criado**: após `addObstacle` retornar com sucesso, marcar o obstáculo novo como expandido em `useCollapseState` (precisa que `addObstacle` devolva o id do registro inserido — ajustar o `.insert(...).select().single()` e propagar o id).

## Detalhes técnicos

- `SortableObstacleCard` (linhas ~280-284): tirar o guard `obstacle.actions.length > 0` em volta do `<button onClick={onToggle}>`.
- Bloco `{obsExpanded && (...)}` (linha 640): manter, mas agora também aparecerá o botão "+ Ação" para obstáculos sem ações (o `SortableContext` aceita lista vazia sem problemas).
- `addObstacle` (linha 351): trocar `await supabase.from("obstacles").insert(...)` por `.insert(...).select("id").single()`, retornar o id e, no callback `onSave` do `InlineText` de novo obstáculo (linha 677), chamar `toggleObstacle(newId)` para já abrir.
- Nenhuma mudança de schema, RLS ou backend.

## Fora de escopo

- Comportamento da visão de tabela (`ObstacleBlock.tsx`) — lá o botão "+ Ação" já aparece independente de ter ações; não precisa mexer.
- Estilos, cores, lógica de drag-and-drop.
