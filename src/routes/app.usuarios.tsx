import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { adminCreateUser, adminSetRole } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, UserCog } from "lucide-react";

export const Route = createFileRoute("/app/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Clínica Zoe" },
      { name: "description", content: "Gerenciamento de usuários e permissões." },
      { property: "og:title", content: "Usuários — Clínica Zoe" },
      { property: "og:description", content: "Gerenciamento de usuários e permissões." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UsuariosPage,
});

const roles: AppRole[] = ["ADMIN", "RECEPCIONISTA", "PROFISSIONAL", "CLIENTE"];

function UsuariosPage() {
  const { hasRole, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !hasRole("ADMIN")) navigate({ to: "/app" });
  }, [loading, hasRole, navigate]);

  const qc = useQueryClient();
  const setRoleFn = useServerFn(adminSetRole);

  const { data, isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const [{ data: profiles }, { data: userRoles }] = await Promise.all([
        supabase.from("profiles").select("id, nome, email, telefone, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map<string, AppRole[]>();
      (userRoles ?? []).forEach((r: any) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p: any) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
    },
  });

  const setRoleMut = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: AppRole }) =>
      setRoleFn({ data: { user_id, role } }),
    onSuccess: () => {
      toast.success("Permissão atualizada");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie contas de acesso e permissões do painel.
          </p>
        </div>
        <NovoUsuarioDialog />
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !data?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <UserCog className="h-5 w-5" />
            </div>
            <p className="text-base font-medium">Nenhum usuário</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {data.map((u: any) => (
            <Card key={u.id} className="border-border shadow-soft">
              <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 sm:flex sm:flex-wrap sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{u.nome || "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{u.roles[0] ?? "SEM ROLE"}</Badge>
                  <Select
                    value={u.roles[0] ?? ""}
                    onValueChange={(v) => setRoleMut.mutate({ user_id: u.id, role: v as AppRole })}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Alterar" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const userSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  email: z.string().trim().email("Email inválido"),
  senha: z.string().min(6, "Mínimo 6 caracteres"),
  telefone: z.string().trim().optional(),
  role: z.enum(["ADMIN", "RECEPCIONISTA", "PROFISSIONAL", "CLIENTE"]),
});

function NovoUsuarioDialog() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const createFn = useServerFn(adminCreateUser);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", telefone: "", role: "RECEPCIONISTA" as AppRole });

  const mut = useMutation({
    mutationFn: async () => {
      const parsed = userSchema.parse(form);
      return createFn({
        data: {
          nome: parsed.nome,
          email: parsed.email,
          senha: parsed.senha,
          telefone: parsed.telefone || null,
          role: parsed.role,
        },
      });
    },
    onSuccess: () => {
      toast.success("Usuário criado");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      setOpen(false);
      setForm({ nome: "", email: "", senha: "", telefone: "", role: "RECEPCIONISTA" });
    },
    onError: (e: any) => {
      if (e instanceof z.ZodError) toast.error(e.issues[0].message);
      else toast.error(e?.message ?? "Falha");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Novo usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar usuário</DialogTitle>
          <DialogDescription>Ideal para recepcionista ou outro administrador.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Senha inicial</Label>
            <Input value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Função</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
