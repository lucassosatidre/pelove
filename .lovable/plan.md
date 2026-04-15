

# Co-responsáveis no balão "Responsável"

## Abordagem
Usar o campo `responsible` existente (texto) para armazenar múltiplos nomes separados por vírgula. Sem alteração no banco de dados.

## Mudanças

### Arquivo: `src/components/mapa/ActionBubbleChain.tsx`

1. Criar componente `ResponsibleBubbleContent` dentro do arquivo:
   - Parsear `action.responsible` por vírgula em array de nomes
   - Renderizar cada nome como um chip/tag pequeno (text-[10px], bg-muted, rounded-full, px-2 py-0.5)
   - Cada chip tem um botão "✕" para remover aquele co-responsável
   - Botão "+" pequeno (h-5 w-5, rounded-full, border-dashed) no final da lista
   - Ao clicar "+", abrir um input inline (ou pequeno popover) para digitar o nome e confirmar com Enter
   - Ao confirmar, adicionar ao array, juntar com vírgula, e chamar `onUpdate(id, "responsible", joined)`
   - Se ficar só 1 nome, salva como texto simples sem vírgula

2. Substituir o `InlineText` atual do bubble "Responsável" pelo novo `ResponsibleBubbleContent`

3. Manter a largura do bubble `w-[160px]` mas permitir scroll vertical interno se muitos nomes (max-h com overflow-y-auto)

### Nenhuma alteração de banco de dados necessária
O campo `responsible` já é `text` e comporta valores separados por vírgula.

