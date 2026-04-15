

# Status com cores individuais + criação de status customizados

## Problema
O status atual usa um `<select>` HTML nativo com opções fixas no código. Não há diferenciação visual por cor na seleção, e não é possível criar novos tipos de status.

## Solução

### 1. Nova tabela `custom_statuses` no banco de dados
Armazena status customizados criados pelo usuário, replicáveis em todas as ações.

```sql
CREATE TABLE public.custom_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280',
  display_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.custom_statuses ENABLE ROW LEVEL SECURITY;
-- RLS: authenticated full access

-- Seed com os 4 status padrão
INSERT INTO public.custom_statuses (value, label, color, display_order, is_default) VALUES
  ('agendado', 'Agendado', '#3B82F6', 1, true),
  ('nao_iniciado', 'Não iniciado', '#6B7280', 2, true),
  ('em_andamento', 'Em andamento', '#F97316', 3, true),
  ('concluido', 'Concluído', '#22C55E', 4, true);
```

### 2. Refatorar `StatusSelect.tsx`
- Substituir o `<select>` nativo por um Popover customizado (Radix Popover)
- Cada opção mostra um dot/pill colorido ao lado do label
- O trigger mostra a cor de fundo do status selecionado (como já faz)
- Adicionar botão "+ Novo status" no final da lista
- Ao clicar, abre um mini form inline: campo de texto para nome + grid de swatches de cor (8-10 cores)
- Ao confirmar, insere na tabela `custom_statuses` e seleciona automaticamente

### 3. Hook `useCustomStatuses`
- Query na tabela `custom_statuses` ordered by `display_order`
- Usado pelo `StatusSelect` e pelo `getComputedStatus`
- Cache com React Query

### 4. Atualizar `useStrategicData.ts`
- `ActionStatus` passa a ser `string` (não mais union type restrita)
- `getComputedStatus` mantém a lógica de "atrasado" para qualquer status que não seja "concluido"
- `STATUS_CONFIG` lê da query em vez de constante hardcoded

### Arquivos alterados
- **Migration**: criar tabela `custom_statuses` + seed
- `src/hooks/useCustomStatuses.ts` (novo)
- `src/components/mapa/StatusSelect.tsx` (refatorar completo)
- `src/hooks/useStrategicData.ts` (flexibilizar tipos)
- `src/components/mapa/ActionBubbleChain.tsx` (passar statuses como prop ou usar hook)

### Sem alteração
- Drag-and-drop, colapso, rich text, menu de contexto, cores de pilar

