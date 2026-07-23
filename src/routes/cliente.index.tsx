import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteShell, Reveal } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { Loader2, CalendarDays, LogOut, Bell, UserCircle2 } from "lucide-react";
import { STATUS_COLOR, STATUS_LABEL, addMinutes, fmtHora, todayISO } from "@/lib/agenda-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cliente/")({
  head: () => ({
    meta: [
      { title: "Área do Cliente — Clínica Zoe" },
      { name: "description", content: "Acompanhe suas consultas, notificações e dados na Clínica Zoe." },
      { property: "og:title", content: "Área do Cliente — Clínica Zoe" },
      { property: "og:description", content: "Suas consultas e notificações." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/cliente" }],
  }),
  component: ClientePage,
});

function ClientePage() {
  const { session, loading, user, nome, signOut, hasAnyRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/cliente/login" });
    } else if (hasAnyRole(["ADMIN", "RECEPCIONISTA", "PROFISSIONAL"])) {
      navigate({ to: "/app" });
    }
  }, [loading, session, hasAnyRole, navigate]);

  if (loading || !session || !user) {
    return (
      <SiteShell>
        <div className="grid min-h-[60vh] place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="border-b border-border bg-gradient-to-br from-secondary via-background to-surface-muted py-12">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Área do Cliente</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Olá, {nome ?? user.email}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/agendamento">
              <Button className="rounded-full">Nova consulta</Button>
            </Link>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Tabs defaultValue="consultas">
            <TabsList>
              <TabsTrigger value="consultas">
                <CalendarDays className="mr-2 h-4 w-4" /> Consultas
              </TabsTrigger>
              <TabsTrigger value="notificacoes">
                <Bell className="mr-2 h-4 w-4" /> Notificações
              </TabsTrigger>
              <TabsTrigger value="perfil">
                <UserCircle2 className="mr-2 h-4 w-4" /> Meus dados
              </TabsTrigger>
            </TabsList>
            <TabsContent value="consultas" className="mt-6">
              <ConsultasSection userId={user.id} />
            </TabsContent>
            <TabsContent value="notificacoes" className="mt-6">
              <NotificacoesSection userId={user.id} />
            </TabsContent>
            <TabsContent value="perfil" className="mt-6">
              <PerfilSection userId={user.id} />
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </SiteShell>
  );
}

function ConsultasSection({ userId }: { userId: string }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["cliente-agendamentos", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(
          "id, data, hora_inicio, hora_fim, status, valor, forma_pagamento, observacoes, profissional:profissionais(id, nome, duracao_consulta_min, especialidade:especialidades(nome))",
        )
        .eq("cliente_user_id", userId)
        .order("data", { ascending: false })
        .order("hora_inicio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: "CANCELADO" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Consulta cancelada.");
      qc.invalidateQueries({ queryKey: ["cliente-agendamentos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <Reveal>
        <div className="rounded-2xl border border-dashed border-border bg-surface-muted p-10 text-center">
          <p className="text-sm text-muted-foreground">Você ainda não tem consultas.</p>
          <Link to="/agendamento" className="mt-4 inline-block">
            <Button className="rounded-full">Agendar primeira consulta</Button>
          </Link>
        </div>
      </Reveal>
    );
  }

  return (
    <div className="grid gap-4">
      {data.map((ag: any, i) => {
        const podeGerenciar = ["PENDENTE", "APROVADO"].includes(ag.status);
        return (
          <Reveal key={ag.id} delay={i * 40}>
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">
                    {ag.profissional?.especialidade?.nome ?? "Consulta"}
                  </p>
                  <p className="mt-1 truncate text-base font-semibold">
                    {ag.profissional?.nome}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(ag.data + "T00:00:00").toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}{" "}
                    · {fmtHora(ag.hora_inicio)} — {fmtHora(ag.hora_fim)}
                  </p>
                  {ag.valor && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Valor:{" "}
                      <span className="font-medium text-foreground">
                        {Number(ag.valor).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </p>
                  )}
                </div>
                <Badge className={cn("border", STATUS_COLOR[ag.status])} variant="outline">
                  {STATUS_LABEL[ag.status]}
                </Badge>
              </div>

              {podeGerenciar && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <RemarcarDialog
                    agendamento={ag}
                    onSaved={() =>
                      qc.invalidateQueries({ queryKey: ["cliente-agendamentos"] })
                    }
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-full">
                        Cancelar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar esta consulta?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação libera o horário. Se precisar, você pode agendar novamente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => cancelar.mutate(ag.id)}>
                          Sim, cancelar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}

function RemarcarDialog({
  agendamento,
  onSaved,
}: {
  agendamento: any;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(todayISO());
  const [hora, setHora] = useState("");

  const { data: slots, isFetching } = useQuery({
    queryKey: ["remarcar-slots", agendamento.profissional?.id, data],
    queryFn: async () => {
      const { data: rows, error } = await supabase.rpc("horarios_disponiveis", {
        p_profissional_id: agendamento.profissional.id,
        p_data: data,
      });
      if (error) throw error;
      return (rows ?? []) as { hora_inicio: string; hora_fim: string }[];
    },
    enabled: open && !!agendamento.profissional?.id,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!hora) throw new Error("Selecione um horário");
      const dur = agendamento.profissional?.duracao_consulta_min ?? 30;
      const hora_fim = addMinutes(hora, dur);
      const { error } = await supabase
        .from("agendamentos")
        .update({ data, hora_inicio: hora, hora_fim, status: "REMARCADO" })
        .eq("id", agendamento.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Consulta remarcada. Aguarde nova aprovação.");
      onSaved();
      setOpen(false);
      setHora("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full">Remarcar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remarcar consulta</DialogTitle>
          <DialogDescription>
            Escolha um novo dia e horário disponível com {agendamento.profissional?.nome}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nova data</Label>
            <Input
              type="date"
              value={data}
              min={todayISO()}
              onChange={(e) => {
                setData(e.target.value);
                setHora("");
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Horários disponíveis</Label>
            {isFetching ? (
              <div className="grid place-items-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : slots?.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((s) => (
                  <button
                    key={s.hora_inicio}
                    onClick={() => setHora(s.hora_inicio.slice(0, 5))}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition",
                      hora === s.hora_inicio.slice(0, 5)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface hover:border-primary/40",
                    )}
                  >
                    {fmtHora(s.hora_inicio)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Sem horários. Escolha outra data.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !hora}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar remarcação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NotificacoesSection({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["cliente-notificacoes", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("id, titulo, mensagem, evento, status_envio, canal, created_at")
        .eq("usuario_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-muted p-10 text-center">
        <p className="text-sm text-muted-foreground">Sem notificações no momento.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {data.map((n: any, i) => (
        <Reveal key={n.id} delay={i * 40}>
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{n.titulo ?? n.evento ?? "Notificação"}</p>
                {n.mensagem && (
                  <p className="mt-1 text-sm text-muted-foreground">{n.mensagem}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              {n.canal && (
                <Badge variant="outline" className="text-xs">
                  {n.canal}
                </Badge>
              )}
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

function PerfilSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["cliente-perfil", userId],
    queryFn: async () => {
      const [{ data: prof }, { data: pac }] = await Promise.all([
        supabase.from("profiles").select("nome, email, telefone").eq("id", userId).maybeSingle(),
        supabase.from("pacientes").select("id, telefone, data_nascimento").eq("user_id", userId).maybeSingle(),
      ]);
      return { prof, pac };
    },
  });

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dob, setDob] = useState("");

  useEffect(() => {
    if (data?.prof) {
      setNome(data.prof.nome ?? "");
      setTelefone(data.prof.telefone ?? data.pac?.telefone ?? "");
      setDob(data.pac?.data_nascimento ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error: e1 } = await supabase
        .from("profiles")
        .update({ nome, telefone })
        .eq("id", userId);
      if (e1) throw e1;

      if (data?.pac?.id) {
        const { error: e2 } = await supabase
          .from("pacientes")
          .update({ telefone, data_nascimento: dob || null })
          .eq("id", data.pac.id);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success("Dados atualizados.");
      qc.invalidateQueries({ queryKey: ["cliente-perfil"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-soft">
      <div className="space-y-2">
        <Label>Nome</Label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={data?.prof?.email ?? ""} disabled />
      </div>
      <div className="space-y-2">
        <Label>Telefone</Label>
        <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
      </div>
      {data?.pac && (
        <div className="space-y-2">
          <Label>Data de nascimento</Label>
          <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </div>
      )}
      <div className="pt-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
