import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { adminCreateUser, adminSetRole } from "@/lib/admin.functions";
import {
  adminListUsers,
  adminSetUserActive,
  adminRemoveUser,
  adminListAudit,
  type AdminUserRow,
} from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PersonAvatar } from "@/lib/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, UserCog, Search, Ban, RotateCcw, Trash2, History } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Clínica Zoe" },
      { name: "description", content: "Gerenciamento de usuários, permissões e auditoria." },
      { property: "og:title", content: "Usuários — Clínica Zoe" },
      { property: "og:description", content: "Gerenciamento de usuários e permissões." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UsuariosPage,
});

const roles: AppRole[] = ["ADMIN", "RECEPCIONISTA", "PROFISSIONAL", "CLIENTE"];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  RECEPCIONISTA: "Recepcionista",
  PROFISSIONAL: "Profissional",
  CLIENTE: "Cliente",
};

const ACAO_LABEL: Record<string, string> = {
  USUARIO_CRIADO: "Usuário criado",
  USUARIO_DESATIVADO: "Usuário desativado",
  USUARIO_REATIVADO: "Usuário reativado",
  USUARIO_REMOVIDO: "Usuário removido",
  PAPEL_ALTERADO: "Papel alterado",
};

const fmtData = (v?: string | null) =>
  v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

function UsuariosPage() {
  const { hasRole, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !hasRole("ADMIN")) navigate({ to: "/app" });
  }, [loading, hasRole, navigate]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie contas de acesso, permissões e status do painel.
          </p>
        </div>
        <NovoUsuarioDialog />
      </div>

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios" className="mt-6">
          <ListaUsuarios />
        </TabsContent>
        <TabsContent value="auditoria" className="mt-6">
          <Auditoria />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ListaUsuarios() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListUsers);
  const setRoleFn = useServerFn(adminSetRole);
  const setActiveFn = useServerFn(adminSetUserActive);
  const removeFn = useServerFn(adminRemoveUser);

  const [busca, setBusca] = useState("");
  const [perfil, setPerfil] = useState<string>("TODOS");
  const [status, setStatus] = useState<string>("TODOS");

  const { data, isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => (await listFn()) as AdminUserRow[],
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["usuarios"] });
    qc.invalidateQueries({ queryKey: ["auditoria-usuarios"] });
    qc.invalidateQueries({ queryKey: ["profissionais"] });
    qc.invalidateQueries({ queryKey: ["profissionais-publicos"] });
  };

  const setRoleMut = useMutation({
    mutationFn: async (v: { user_id: string; role: AppRole }) => setRoleFn({ data: v }),
    onSuccess: () => {
      toast.success("Permissão atualizada");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });

  const activeMut = useMutation({
    mutationFn: async (v: { user_id: string; ativo: boolean }) => setActiveFn({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.ativo ? "Usuário reativado" : "Usuário desativado");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });

  const removeMut = useMutation({
    mutationFn: async (user_id: string) => removeFn({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Usuário removido com segurança. O histórico foi preservado.");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (data ?? []).filter((u) => {
      if (perfil !== "TODOS" && !u.roles.includes(perfil)) return false;
      if (status === "ATIVO" && (!u.ativo || u.removido_em)) return false;
      if (status === "INATIVO" && (u.ativo || u.removido_em)) return false;
      if (status === "REMOVIDO" && !u.removido_em) return false;
      if (termo) {
        const alvo = `${u.nome ?? ""} ${u.email ?? ""}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [data, busca, perfil, status]);

  return (
    <div className="space-y-4">
      <Card className="border-border shadow-soft">
        <CardContent className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_200px_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou email"
              className="pl-9"
              aria-label="Buscar usuários"
            />
          </div>
          <Select value={perfil} onValueChange={setPerfil}>
            <SelectTrigger aria-label="Filtrar por perfil">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os perfis</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Filtrar por status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os status</SelectItem>
              <SelectItem value="ATIVO">Ativos</SelectItem>
              <SelectItem value="INATIVO">Inativos</SelectItem>
              <SelectItem value="REMOVIDO">Removidos</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !filtrados.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <UserCog className="h-5 w-5" />
            </div>
            <p className="text-base font-medium">Nenhum usuário encontrado</p>
            <p className="text-sm text-muted-foreground">Ajuste os filtros e tente novamente.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtrados.map((u) => {
            const removido = !!u.removido_em;
            return (
              <Card
                key={u.id}
                className={cn(
                  "border-border shadow-soft transition-all duration-300 hover:shadow-elegant",
                  removido && "opacity-70",
                )}
              >
                <CardContent className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <PersonAvatar nome={u.nome ?? u.email ?? "?"} fotoUrl={u.foto_url} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{u.nome || "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Criado em {fmtData(u.created_at)} · Último acesso{" "}
                        {fmtData(u.last_sign_in_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {ROLE_LABEL[u.roles[0]] ?? "Sem perfil"}
                    </Badge>
                    <Badge
                      className={cn(
                        removido
                          ? "bg-muted text-muted-foreground"
                          : u.ativo
                            ? "bg-primary/10 text-primary"
                            : "bg-destructive/10 text-destructive",
                      )}
                      variant="outline"
                    >
                      {removido ? "Removido" : u.ativo ? "Ativo" : "Inativo"}
                    </Badge>

                    {!removido && (
                      <>
                        <Select
                          value={u.roles[0] ?? ""}
                          onValueChange={(v) =>
                            setRoleMut.mutate({ user_id: u.id, role: v as AppRole })
                          }
                        >
                          <SelectTrigger className="w-[170px]">
                            <SelectValue placeholder="Alterar perfil" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={activeMut.isPending}
                          onClick={() => activeMut.mutate({ user_id: u.id, ativo: !u.ativo })}
                        >
                          {u.ativo ? (
                            <>
                              <Ban className="h-3.5 w-3.5" /> Desativar
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-3.5 w-3.5" /> Reativar
                            </>
                          )}
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-1.5 text-destructive">
                              <Trash2 className="h-3.5 w-3.5" /> Remover
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover {u.nome || u.email}? Esta ação poderá
                                ser irreversível. O acesso será revogado, mas consultas, lançamentos
                                financeiros, histórico e notificações serão preservados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => removeMut.mutate(u.id)}
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Auditoria() {
  const listFn = useServerFn(adminListAudit);
  const { data, isLoading } = useQuery({
    queryKey: ["auditoria-usuarios"],
    queryFn: async () => (await listFn()) as any[],
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <History className="h-5 w-5" />
          </div>
          <p className="text-base font-medium">Nenhum registro de auditoria ainda</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-2">
      {data.map((a) => (
        <Card key={a.id} className="border-border shadow-soft">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {ACAO_LABEL[a.acao] ?? a.acao}
                {a.target_nome ? ` — ${a.target_nome}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Por {a.actor_nome ?? "sistema"} · {a.detalhes ?? ""}
              </p>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {fmtData(a.created_at)}
            </span>
          </CardContent>
        </Card>
      ))}
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
  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    telefone: "",
    role: "RECEPCIONISTA" as AppRole,
  });

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
      qc.invalidateQueries({ queryKey: ["auditoria-usuarios"] });
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
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Senha inicial</Label>
            <Input value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />
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
                    {ROLE_LABEL[r]}
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
