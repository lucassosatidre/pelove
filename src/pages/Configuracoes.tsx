import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, KeyRound, Loader2 } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
}

async function call(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await supabase.functions.invoke(`admin-users${path}`, {
    method: (options.method ?? "GET") as any,
    body: options.body ? JSON.parse(options.body as string) : undefined,
    headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
  });
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export default function Configuracoes() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);

  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const data = await call("");
      return data.users as AdminUser[];
    },
  });

  const createMut = useMutation({
    mutationFn: (payload: { email: string; password: string; name: string; role: string }) =>
      call("", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      toast({ title: "Usuário criado!" });
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      call(`/${id}`, { method: "PATCH", body: JSON.stringify({ role }) }),
    onSuccess: () => {
      toast({ title: "Role atualizado!" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => call(`/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Usuário removido!" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const resetMut = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      call(`/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
    onSuccess: () => {
      toast({ title: "Senha redefinida!" });
      setResetUser(null);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configurações de Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie quem tem acesso ao PE Love</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Novo Usuário</Button>
          </DialogTrigger>
          <CreateUserDialog onSubmit={(p) => createMut.mutate(p)} loading={createMut.isPending} />
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Usuários</CardTitle></CardHeader>
        <CardContent>
          {usersQ.isLoading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>}
          {usersQ.error && <div className="text-destructive text-sm">{(usersQ.error as Error).message}</div>}
          {usersQ.data && (
            <div className="space-y-2">
              {usersQ.data.map((u) => {
                const isAdmin = u.roles.includes("admin");
                return (
                  <div key={u.id} className="flex items-center justify-between border border-border rounded-lg p-3 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{u.email}</span>
                        <Badge variant={isAdmin ? "default" : "secondary"}>{isAdmin ? "Admin" : "Operador"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Último acesso: {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-BR") : "nunca"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Select
                        value={isAdmin ? "admin" : "operador"}
                        onValueChange={(v) => roleMut.mutate({ id: u.id, role: v })}
                      >
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="operador">Operador</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={() => setResetUser(u)} title="Redefinir senha">
                        <KeyRound className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remover ${u.email}? Esta ação não pode ser desfeita.`)) deleteMut.mutate(u.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!resetUser} onOpenChange={(open) => !open && setResetUser(null)}>
        <ResetPasswordDialog
          user={resetUser}
          onSubmit={(password) => resetUser && resetMut.mutate({ id: resetUser.id, password })}
          loading={resetMut.isPending}
        />
      </Dialog>
    </div>
  );
}

function CreateUserDialog({ onSubmit, loading }: { onSubmit: (p: any) => void; loading: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("operador");

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Novo Usuário</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1"><Label>Senha inicial (min 8)</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <div className="space-y-1">
          <Label>Perfil</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="operador">Operador (Mapa + Advisor)</SelectItem>
              <SelectItem value="admin">Admin (acesso total)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit({ email, password, name, role })} disabled={loading || !email || !password}>
          {loading ? "Criando..." : "Criar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ResetPasswordDialog({ user, onSubmit, loading }: { user: AdminUser | null; onSubmit: (p: string) => void; loading: boolean }) {
  const [password, setPassword] = useState("");
  if (!user) return null;
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Redefinir senha — {user.email}</DialogTitle></DialogHeader>
      <div className="space-y-1">
        <Label>Nova senha (min 8)</Label>
        <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(password)} disabled={loading || password.length < 8}>
          {loading ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
