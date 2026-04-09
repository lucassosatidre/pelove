

## Reset password for adm@pelove.com

The password for **adm@pelove.com** will be reset to **562301Abc.** using a database admin API call.

### Implementation

1. Create a one-time edge function (or use the Supabase Admin API via an existing edge function) to call `supabase.auth.admin.updateUserById()` with the new password.
2. Alternatively, use a simpler approach: create a short migration-style script that invokes the admin password update.

### Technical detail

- Call `supabase.auth.admin.updateUserById(userId, { password: '562301Abc.' })` using the service role key
- The user ID for adm@pelove.com will be fetched from `auth.users`
- This is a one-time operation; no permanent code changes needed

