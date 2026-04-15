

# Fix: Visão 2027 minimizável no Mapa Estratégico

## Problema
O componente `VisionHeader.tsx` tem a lógica de colapso, mas **não é usado** no mapa. O `MindMapLayout.tsx` renderiza o card da Visão diretamente (linhas 529-549) sem nenhum botão de minimizar.

## Solução
Adicionar a funcionalidade de colapso diretamente no card da Visão dentro de `MindMapLayout.tsx`:

### Arquivo: `src/components/mapa/MindMapLayout.tsx`

1. Importar `ChevronUp`, `ChevronDown` do lucide-react
2. Adicionar estado `visionCollapsed` com `useState`, inicializado pelo `localStorage` (chave `pe-love-vision-collapsed`)
3. Adicionar função `toggleVision` que alterna o estado e salva no localStorage
4. No card da Visão (linhas 530-549):
   - Tornar o Badge clicável (envolver em botão com `onClick={toggleVision}`)
   - Adicionar ícone ChevronDown/ChevronUp ao lado do Badge
   - Envolver o `RichInlineText` em div com `transition-all duration-300 ease-in-out overflow-hidden` e classes condicionais `max-h-0 opacity-0` / `max-h-[500px] opacity-100`
   - Quando colapsado, o card fica compacto (~48px, só o badge visível)

Nenhuma outra alteração necessária.

