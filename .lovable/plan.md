
# Plano — Perfis admin/operador no PE Love

## 1. Schema de roles

**Hoje:**
- Existe `public.profiles` com coluna `role text NOT NULL DEFAULT 'admin'` (todo novo usuário cai como admin via trigger `handle_new_user`).
- Não existe tabela dedicada de roles nem função `has_role`.
- Guardar role em `profiles` é anti-pattern (a própria policy de `profiles` já faz auto-referência: `EXISTS (SELECT … FROM profiles WHERE role='admin')`, que pode causar recursão e é facilmente escalável por um update do próprio usuário no perfil).

**Proposta:**
1. Criar `enum app_role` com valores `admin`, `operador`.
2. Criar `public.user_roles (id, user_id uuid → auth.users, role app_role, unique(user_id, role))` com RLS habilitada.
3. Criar `public.has_role(_user_id uuid, _role app_role) returns boolean` como `SECURITY DEFINER STABLE`, usada em todas as políticas (evita recursão).
4. **Migração do admin atual sem downtime:**
   - Na mesma migração que cria `user_roles`: `INSERT INTO user_roles (user_id, role) SELECT user_id, 'admin' FROM profiles WHERE role = 'admin' ON CONFLICT DO NOTHING;` — isso pega o `adm@pelove.com` e qualquer outro admin pré-existente.
   - Atualizar o trigger `handle_new_user` para também inserir em `user_roles` com role `operador` por padrão (e parar de gravar `role` em `profiles`).
   - Manter a coluna `profiles.role` por ora (legacy, só leitura) e remover em migração futura — evita quebrar código que ainda lê `profile.role`.
5. Após criar `user_roles`, **substituir a policy de SELECT em `profiles`** pela versão `has_role(auth.uid(),'admin')` para acabar com a recursão.

## 2. RLS por tabela

### Grupo A — Mapa Estratégico (compartilhado, qualquer autenticado lê/escreve)
Sem mudança funcional, só revisar:
- `vision`, `pillars`, `obstacles`, `actions`, `custom_statuses` — manter `USING (true)` / `WITH CHECK (true)` para `authenticated`. (O calendário/acompanhamento usa as mesmas tabelas; não há tabela separada.)

### Grupo B — Advisor (estritamente por usuário) ⚠️ crítico
- `advisor_conversations` — já está correto (`auth.uid() = user_id`). Manter.
- `advisor_messages` — já filtra via join com `advisor_conversations.user_id = auth.uid()`. Manter.
- `advisor_facts` — já correto. Manter.
- `advisor_app_events` — já correto. Manter.
- `advisor_insights` — **HOJE está aberto a qualquer authenticated** (`USING (true)`) e não tem coluna `user_id`. **Mudanças necessárias:**
  - Adicionar coluna `user_id uuid` (nullable inicialmente para migrar dados).
  - Backfill: atribuir todos os insights existentes ao admin `adm@pelove.com` (`UPDATE advisor_insights SET user_id = (SELECT id FROM auth.users WHERE email='adm@pelove.com')`).
  - Tornar `user_id NOT NULL`.
  - Trocar policies para `auth.uid() = user_id` (SELECT + UPDATE).
  - Adicionar policy de INSERT (hoje não tem) — necessária se a edge function `advisor-generate-insights` rodar com JWT de usuário. Se roda com service role, ela bypassa RLS — verificar.
  - **Decisão pendente:** a função `advisor-generate-insights` é um cron diário global. Precisamos definir se ela gera insights por usuário (loop em cada user) ou se passa a ser disparada manualmente por cada user. Ver §6.

### Grupo C — DRE / Dashboards / Saipos (só admin)
Trocar todas as policies `authenticated USING (true)` por `has_role(auth.uid(), 'admin')`:
- `saipos_sales`, `saipos_sales_items`, `saipos_status_history`, `saipos_financial`, `saipos_financial_imports`, `saipos_financial_manual`, `saipos_config`, `saipos_sync_runs`, `saipos_backfill_progress`
- `dre_snapshot`, `dre_snapshot_imports`
- `clau_tool_logs` (logs internos do advisor/MCP — manter só admin)

### Grupo D — Tabela de roles
- `user_roles` SELECT: usuário vê as próprias roles + admin vê todas.
- `user_roles` INSERT/UPDATE/DELETE: apenas admin (`has_role(auth.uid(),'admin')`).

### Grupo E — Profiles
- SELECT: o próprio (`auth.uid()=user_id`) **OU** admin (`has_role`).
- INSERT/UPDATE: o próprio (admin pode atualizar via edge function com service role).

## 3. Auth — criação/gerenciamento de operador

**Recomendação:** edge function `admin-users` (verify_jwt obrigatório) que:
1. Valida JWT do chamador e confirma `has_role(uid,'admin')` via query antes de qualquer operação.
2. Usa `SUPABASE_SERVICE_ROLE_KEY` para chamar Supabase Admin API.

**Operações expostas:**
- `POST /admin-users` — criar operador. Admin escolhe e-mail + senha inicial. Usa `supabase.auth.admin.createUser({ email, password, email_confirm: true })` (sem fluxo de convite, mais simples e o admin já comunica a senha). Após criar, inserir em `user_roles` com role `operador`.
- `GET /admin-users` — listar (join `auth.users` + `user_roles`).
- `PATCH /admin-users/:id` — alterar role (toggle admin/operador).
- `POST /admin-users/:id/reset-password` — admin define nova senha (`auth.admin.updateUserById(id, { password })`).
- `DELETE /admin-users/:id` — `auth.admin.deleteUser(id)` (cascateia profiles e user_roles via FK ON DELETE CASCADE).

**Reset de senha pelo próprio usuário:** botão "Esqueci senha" na tela de login usando `supabase.auth.resetPasswordForEmail` (fluxo padrão por e-mail) — exige configurar template de e-mail na Cloud.

## 4. Frontend

**Novo:**
- `src/hooks/useUserRole.ts` — query React Query que lê `user_roles` do usuário logado, retorna `{ role, isAdmin, isOperador, loading }`. Cacheia.
- `src/components/RoleGuard.tsx` — wrapper de rota: recebe `allowedRoles` e redireciona pra `/mapa` se não tiver permissão.
- `src/pages/Configuracoes.tsx` (nova) — listagem de usuários, modal de criar/editar, botão reset de senha, toggle de role.

**Editar:**
- `AuthContext.tsx` — expor `role` (vindo de `user_roles`, não mais de `profiles.role`).
- `AppSidebar.tsx` — filtrar `menuItems` por role. Operador vê só Mapa Estratégico + Advisor. Adicionar item "Configurações" só para admin.
- `App.tsx` — envolver rotas restritas com `<RoleGuard allowedRoles={['admin']}>`:
  - `/dashboards`, `/dre`, `/dre/import`, `/dre-v2`, `/configuracoes/saipos`, `/configuracoes` (nova).
  - `/mapa` e `/advisor` ficam acessíveis a ambos.
- `Login.tsx` — adicionar link "Esqueci minha senha".

## 5. Migração de dados existentes

- **profiles:** o trigger atual já criou um profile pro `adm@pelove.com`. Continua valendo.
- **user_roles:** popular via `INSERT … SELECT FROM profiles WHERE role='admin'` na migração — garante que o admin atual entra como admin antes da RLS estrita ligar.
- **advisor_conversations / messages / facts / app_events:** todos já têm `user_id` ligado ao admin (único usuário hoje). Nada some quando a RLS apertar — o admin continua vendo as próprias coisas.
- **advisor_insights:** sem `user_id` hoje → backfill atribuindo tudo ao admin antes de tornar `NOT NULL`. Após migração, todo insight pré-existente fica só visível pro admin (esperado).
- **Ordem da migração (crítica):**
  1. Criar enum + `user_roles` + `has_role` + popular admin.
  2. Adicionar `advisor_insights.user_id` + backfill + NOT NULL.
  3. Trocar policies (admin-only nas tabelas C, user_id-strict em insights).
  4. Atualizar trigger `handle_new_user`.
  5. Deploy de código frontend + edge function `admin-users`.
- **Validação pós-migração:** logar como `adm@pelove.com`, conferir que vê tudo. Criar operador de teste, conferir que vê só Mapa+Advisor e tem Advisor zerado.

## 6. Riscos e decisões pendentes

1. **`advisor-generate-insights` (cron diário):** hoje gera insights "globais". Com `user_id` obrigatório, precisa de uma decisão:
   - (a) cron continua e gera só pro admin (mais simples, operadores não recebem insights automáticos);
   - (b) cron itera por todos os usuários (mais trabalho, custa mais tokens);
   - (c) deixa o cron e cada usuário "puxa" insights via botão na UI.
   - **Recomendo (a)** no curto prazo.
2. **Edge functions internas que escrevem nas tabelas Saipos/DRE** (saipos-cron, saipos-sync-window, import-*) rodam com service role e bypassam RLS — confirmar que nenhuma usa o JWT do usuário. Se alguma usar, vai quebrar ao apertar a RLS.
3. **Coluna `profiles.role` legada:** manter por ora ou dropar? Recomendo manter por 1 deploy e dropar depois de confirmar que nada lê mais.
4. **MCP / OpenClaw (`clau_tool_logs`, função `run_sql_select`):** o agente externo via OpenClaw provavelmente roda como admin. Confirmar que ele continua funcional após RLS apertar — pode precisar de role/token dedicado.
5. **Política de senhas:** ativar HIBP check (leaked password protection) na Cloud? Recomendado.
6. **Reset de senha por e-mail:** exige template de e-mail configurado e domínio. Se o usuário não quiser configurar agora, fica só o "admin reseta manualmente" (suficiente para começar).
7. **Convite por e-mail vs senha definida pelo admin:** estou propondo senha-pelo-admin (mais simples, sem dependência de e-mail). Confirmar se prefere convite (`inviteUserByEmail`).
8. **Exclusão de operador:** delete hard via `auth.admin.deleteUser` apaga as conversas/facts do Advisor dele junto. OK? Ou prefere soft-delete (flag `disabled`)?

