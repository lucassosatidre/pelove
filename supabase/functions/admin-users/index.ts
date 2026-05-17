// Edge function: gerenciamento de usuários (admin-only)
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    // Cliente "como usuário" para validar identidade
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // Cliente service-role para tudo
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Confirma que o chamador é admin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden — admin only" }, 403);

    const url = new URL(req.url);
    // Path: /admin-users/<id>[/reset-password]
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("admin-users");
    const targetId = parts[idx + 1] ?? null;
    const action = parts[idx + 2] ?? null;

    // GET /admin-users => listar
    if (req.method === "GET" && !targetId) {
      const { data: usersList, error } = await admin.auth.admin.listUsers();
      if (error) return json({ error: error.message }, 500);
      const { data: roles } = await admin.from("user_roles").select("user_id, role");
      const rolesByUser = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });
      const users = usersList.users.map((u: any) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        roles: rolesByUser.get(u.id) ?? [],
      }));
      return json({ users });
    }

    // POST /admin-users => criar
    if (req.method === "POST" && !targetId) {
      const body = await req.json();
      const { email, password, name, role } = body ?? {};
      if (!email || !password || !role) return json({ error: "email, password e role são obrigatórios" }, 400);
      if (!["admin", "operador"].includes(role)) return json({ error: "role inválido" }, 400);
      if (String(password).length < 8) return json({ error: "Senha precisa ter ao menos 8 caracteres" }, 400);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: name ?? email.split("@")[0] },
      });
      if (createErr) return json({ error: createErr.message }, 400);

      // Trigger handle_new_user já insere role 'operador'. Se queremos admin, faz upsert.
      if (role === "admin") {
        await admin.from("user_roles").delete().eq("user_id", created.user.id);
        await admin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
      }
      return json({ user: created.user });
    }

    if (!targetId) return json({ error: "Not found" }, 404);

    // PATCH /admin-users/<id> => alterar role
    if (req.method === "PATCH" && !action) {
      const body = await req.json();
      const { role } = body ?? {};
      if (!role || !["admin", "operador"].includes(role)) return json({ error: "role inválido" }, 400);

      // Bloqueia rebaixar a si mesmo
      if (targetId === user.id && role !== "admin") {
        return json({ error: "Você não pode rebaixar sua própria conta" }, 400);
      }

      await admin.from("user_roles").delete().eq("user_id", targetId);
      const { error: insErr } = await admin.from("user_roles").insert({ user_id: targetId, role });
      if (insErr) return json({ error: insErr.message }, 500);
      return json({ success: true });
    }

    // POST /admin-users/<id>/reset-password
    if (req.method === "POST" && action === "reset-password") {
      const body = await req.json();
      const { password } = body ?? {};
      if (!password || String(password).length < 8) return json({ error: "Senha precisa ter ao menos 8 caracteres" }, 400);
      const { error } = await admin.auth.admin.updateUserById(targetId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // DELETE /admin-users/<id>
    if (req.method === "DELETE" && !action) {
      if (targetId === user.id) return json({ error: "Você não pode deletar sua própria conta" }, 400);
      const { error } = await admin.auth.admin.deleteUser(targetId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
