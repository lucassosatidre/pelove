# Habilitar pg_cron para sincronizações agendadas

## Situação atual
Verifiquei `pg_extension` no banco: nenhuma das extensões necessárias está habilitada.
- `pg_cron`: ❌ não habilitada
- `pg_net`: ❌ não habilitada (necessária pra chamar API externa via HTTP a partir do cron)

## O que será feito

### Migração SQL
```sql
-- Agendamento de jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Chamadas HTTP a partir do banco (necessário pra hitar API externa via cron)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

Ambas instaladas no schema `extensions` (padrão recomendado do Supabase, fora do `public`).

## Como usar depois (referência)

Pra agendar uma sync chamando uma edge function a cada 5 minutos, por exemplo:

```sql
SELECT cron.schedule(
  'sync-saipos-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://swheayxfkbewstpzimfc.supabase.co/functions/v1/<nome-da-function>',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

Listar / remover jobs:
```sql
SELECT * FROM cron.job;
SELECT cron.unschedule('sync-saipos-every-5min');
```

## Recomendação adicional (opcional)
Se você quer que eu já crie a edge function de sync com a Saipos (já vi que tem `SAIPOS_API_KEY` configurada) e deixe o cron job agendado, me diga:
1. Endpoint da API Saipos a chamar
2. Frequência desejada
3. O que persistir/atualizar no banco

Se preferir só habilitar as extensões agora e configurar o resto depois, é só aprovar este plano.
