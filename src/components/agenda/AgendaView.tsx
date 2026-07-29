import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dispararNotificacoesAgendamento } from "@/lib/notifications.functions";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Ban,
  MoreVertical,
  Clock,
} from "lucide-react";
import {
  STATUS_COLOR,
  STATUS_LABEL,
  addMinutes,
  fmtHora,
  todayISO,
} from "@/lib/agenda-utils";
import { PersonAvatar } from "@/lib/avatar";

type Props = {
  /** Escopo do profissional: quando definido, trava a agenda ao próprio profissional (view PROFISSIONAL) */
  scopedProfissionalId?: string | null;
  /** Se true, permite escolher entre todos os profissionais ativos */
  allowSelectProfissional?: boolean;
  title?: string;
  subtitle?: string;
};

export function AgendaView({
  scopedProfissionalId = null,
  allowSelectProfissional = true,
  title = "Agenda",
  subtitle,
}: Props) {
  const qc = useQueryClient();
  const [data, setData] = useState<string>(todayISO());
  const [selectedProf, setSelectedProf] = useState<string | "ALL">(
    scopedProfissionalId ?? "ALL",
  );

  const { data: profissionais } = useQuery({
    queryKey: ["profissionais-ativos"],
    queryFn: async () => {
      const q = supabase
        .from("profissionais")
        .select("id, nome, duracao_consulta_min, valor_consulta_avista, especialidade:especialidades(nome)")
        .eq("status", "ATIVO")
        .order("nome");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: allowSelectProfissional,
  });

  const effectiveProfId =
    scopedProfissionalId ?? (selectedProf === "ALL" ? null : selectedProf);

  const { data: agendamentos, isLoading } = useQuery({
    queryKey: ["agenda", data, effectiveProfId ?? "ALL"],
    queryFn: async () => {
      let q = supabase
        .from("agendamentos")
        .select(
          "id, data, hora_inicio, hora_fim, status, valor, forma_pagamento, observacoes, paciente:pacientes(id,nome,telefone,whatsapp,foto_url), profissional:profissionais(id,nome,foto_url,especialidade:especialidades(nome))",
        )
        .eq("data", data)
        .order("hora_inicio");
      if (effectiveProfId) q = q.eq("profissional_id", effectiveProfId);
      const { data: rows, error } = await q;
      if (error) throw error;
      return rows ?? [];
    },
  });

  const { data: bloqueios } = useQuery({
    queryKey: ["bloqueios", data, effectiveProfId ?? "ALL"],
    queryFn: async () => {
      let q = supabase
        .from("profissional_bloqueio")
        .select("id, profissional_id, data, hora_inicio, hora_fim, motivo, profissional:profissionais(nome)")
        .eq("data", data)
        .order("hora_inicio");
      if (effectiveProfId) q = q.eq("profissional_id", effectiveProfId);
      const { data: rows, error } = await q;
      if (error) throw error;
      return rows ?? [];
    },
  });

  const changeDate = (delta: number) => {
    const d = new Date(data + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setData(d.toISOString().slice(0, 10));
  };

  const dateLabel = useMemo(() => {
    const d = new Date(data + "T12:00:00");
    return d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, [data]);

  const dispararFn = useServerFn(dispararNotificacoesAgendamento);

  const statusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "PENDENTE" | "APROVADO" | "RECUSADO" | "CANCELADO" | "REMARCADO" | "FINALIZADO" }) => {
      const { error } = await supabase.from("agendamentos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success("Status atualizado");
      dispararFn({ data: { agendamentoId: vars.id } }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });

  const delBloqueio = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profissional_bloqueio").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bloqueio removido");
      qc.invalidateQueries({ queryKey: ["bloqueios"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <NovoBloqueioDialog
            scopedProfissionalId={scopedProfissionalId}
            profissionais={profissionais ?? []}
            defaultDate={data}
          />
          <NovoAgendamentoDialog
            scopedProfissionalId={scopedProfissionalId}
            profissionais={profissionais ?? []}
            defaultDate={data}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => changeDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-[170px]"
            />
            <Button variant="ghost" size="sm" onClick={() => setData(todayISO())}>
              Hoje
            </Button>
          </div>
          <CardTitle className="text-base font-medium capitalize text-muted-foreground">
            {dateLabel}
          </CardTitle>
          {allowSelectProfissional && !scopedProfissionalId && (
            <Select value={selectedProf} onValueChange={(v) => setSelectedProf(v as any)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar profissional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos profissionais</SelectItem>
                {profissionais?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (agendamentos?.length ?? 0) === 0 && (bloqueios?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>
              <p className="text-base font-medium">Nenhum agendamento neste dia</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Clique em "Novo agendamento" para marcar uma consulta.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bloqueios?.map((b: any) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-destructive/30 bg-destructive/5 p-3"
                >
                  <Ban className="h-4 w-4 text-destructive" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      Bloqueio • {fmtHora(b.hora_inicio)}–{fmtHora(b.hora_fim)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.profissional?.nome} {b.motivo ? `— ${b.motivo}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => delBloqueio.mutate(b.id)}
                  >
                    Remover
                  </Button>
                </div>
              ))}
              {agendamentos?.map((a: any) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-soft transition hover:shadow-elegant"
                >
                  <div className="flex w-20 shrink-0 flex-col text-sm">
                    <span className="font-semibold">{fmtHora(a.hora_inicio)}</span>
                    <span className="text-xs text-muted-foreground">{fmtHora(a.hora_fim)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="flex min-w-0 items-center gap-2 truncate font-medium">
                        <PersonAvatar size="xs" nome={a.paciente?.nome} fotoUrl={a.paciente?.foto_url} />
                        <span className="truncate">{a.paciente?.nome ?? "Sem paciente"}</span>
                      </p>
                      <Badge variant="outline" className={STATUS_COLOR[a.status]}>
                        {STATUS_LABEL[a.status]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {a.profissional?.nome} • {a.profissional?.especialidade?.nome ?? "—"}
                      {a.valor ? ` • R$ ${Number(a.valor).toFixed(2)}` : ""}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => statusMut.mutate({ id: a.id, status: "APROVADO" })}>
                        Aprovar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => statusMut.mutate({ id: a.id, status: "FINALIZADO" })}>
                        Finalizar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => statusMut.mutate({ id: a.id, status: "REMARCADO" })}>
                        Marcar como remarcado
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => statusMut.mutate({ id: a.id, status: "RECUSADO" })}
                      >
                        Recusar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => statusMut.mutate({ id: a.id, status: "CANCELADO" })}
                      >
                        Cancelar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------- Novo agendamento -------------------- */

const agSchema = z.object({
  profissional_id: z.string().uuid("Selecione o profissional"),
  paciente_id: z.string().uuid("Selecione o paciente"),
  data: z.string().min(1),
  hora_inicio: z.string().min(1),
  hora_fim: z.string().min(1),
  valor: z.number().nonnegative().optional(),
  forma_pagamento: z.string().optional(),
  observacoes: z.string().optional(),
});

function NovoAgendamentoDialog({
  scopedProfissionalId,
  profissionais,
  defaultDate,
}: {
  scopedProfissionalId: string | null;
  profissionais: any[];
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    profissional_id: scopedProfissionalId ?? "",
    paciente_id: "",
    data: defaultDate,
    hora_inicio: "09:00",
    hora_fim: "10:00",
    valor: "",
    forma_pagamento: "",
    observacoes: "",
  });

  const { data: pacientes } = useQuery({
    queryKey: ["pacientes-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacientes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const selectedProf = profissionais.find((p) => p.id === form.profissional_id);

  const setStart = (v: string) => {
    const dur = selectedProf?.duracao_consulta_min ?? 60;
    setForm((f) => ({
      ...f,
      hora_inicio: v,
      hora_fim: addMinutes(v, dur),
      valor: f.valor || String(selectedProf?.valor_consulta_avista ?? ""),
    }));
  };

  const mut = useMutation({
    mutationFn: async () => {
      const parsed = agSchema.parse({
        ...form,
        valor: form.valor ? Number(form.valor) : undefined,
      });
      const { error } = await supabase.from("agendamentos").insert({
        profissional_id: parsed.profissional_id,
        paciente_id: parsed.paciente_id,
        data: parsed.data,
        hora_inicio: parsed.hora_inicio,
        hora_fim: parsed.hora_fim,
        valor: parsed.valor ?? null,
        forma_pagamento: (parsed.forma_pagamento as any) || null,
        observacoes: parsed.observacoes || null,
        status: "PENDENTE",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento criado");
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      setForm((f) => ({ ...f, paciente_id: "", observacoes: "" }));
    },
    onError: (e: any) => {
      if (e instanceof z.ZodError) toast.error(e.issues[0].message);
      else toast.error(e?.message ?? "Falha ao criar");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Novo agendamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>
            O sistema valida conflitos, bloqueios e disponibilidade automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Profissional</Label>
            <Select
              value={form.profissional_id}
              onValueChange={(v) => setForm({ ...form, profissional_id: v })}
              disabled={!!scopedProfissionalId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {profissionais.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Paciente</Label>
            <Select
              value={form.paciente_id}
              onValueChange={(v) => setForm({ ...form, paciente_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {pacientes?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="time" value={form.hora_inicio} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input
                type="time"
                value={form.hora_fim}
                onChange={(e) => setForm({ ...form, hora_fim: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Pagamento</Label>
            <Select
              value={form.forma_pagamento}
              onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {["DINHEIRO", "PIX", "CARTAO_DEBITO", "CARTAO_CREDITO", "OUTRO"].map((f) => (
                  <SelectItem key={f} value={f}>
                    {f.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
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

/* -------------------- Novo bloqueio -------------------- */

function NovoBloqueioDialog({
  scopedProfissionalId,
  profissionais,
  defaultDate,
}: {
  scopedProfissionalId: string | null;
  profissionais: any[];
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    profissional_id: scopedProfissionalId ?? "",
    data: defaultDate,
    hora_inicio: "12:00",
    hora_fim: "13:00",
    motivo: "",
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.profissional_id) throw new Error("Selecione o profissional");
      const { error } = await supabase.from("profissional_bloqueio").insert({
        profissional_id: form.profissional_id,
        data: form.data,
        hora_inicio: form.hora_inicio,
        hora_fim: form.hora_fim,
        motivo: form.motivo || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Horário bloqueado");
      qc.invalidateQueries({ queryKey: ["bloqueios"] });
      setOpen(false);
      setForm((f) => ({ ...f, motivo: "" }));
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao bloquear"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Ban className="h-4 w-4" /> Bloquear horário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bloquear horário</DialogTitle>
          <DialogDescription>
            Impede novos agendamentos no intervalo indicado.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Profissional</Label>
            <Select
              value={form.profissional_id}
              onValueChange={(v) => setForm({ ...form, profissional_id: v })}
              disabled={!!scopedProfissionalId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {profissionais.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Início</Label>
            <Input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Fim</Label>
            <Input type="time" value={form.hora_fim} onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Bloquear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Disponibilidade Semanal -------------------- */

export function DisponibilidadeCard({ profissionalId }: { profissionalId: string }) {
  const qc = useQueryClient();
  const { data: rows, isLoading } = useQuery({
    queryKey: ["disponibilidade", profissionalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissional_disponibilidade")
        .select("id, dia_semana, hora_inicio, hora_fim")
        .eq("profissional_id", profissionalId)
        .order("dia_semana")
        .order("hora_inicio");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({ dia_semana: "1", hora_inicio: "08:00", hora_fim: "18:00" });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profissional_disponibilidade").insert({
        profissional_id: profissionalId,
        dia_semana: Number(form.dia_semana),
        hora_inicio: form.hora_inicio,
        hora_fim: form.hora_fim,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Disponibilidade adicionada");
      qc.invalidateQueries({ queryKey: ["disponibilidade", profissionalId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profissional_disponibilidade").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["disponibilidade", profissionalId] }),
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });

  const dias = [
    { v: 0, l: "Domingo" }, { v: 1, l: "Segunda" }, { v: 2, l: "Terça" },
    { v: 3, l: "Quarta" }, { v: 4, l: "Quinta" }, { v: 5, l: "Sexta" }, { v: 6, l: "Sábado" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" /> Disponibilidade semanal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <Select value={form.dia_semana} onValueChange={(v) => setForm({ ...form, dia_semana: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {dias.map((d) => <SelectItem key={d.v} value={String(d.v)}>{d.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
          <Input type="time" value={form.hora_fim} onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} />
          <Button onClick={() => add.mutate()} disabled={add.isPending}>
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !rows?.length ? (
          <p className="text-sm text-muted-foreground">
            Sem disponibilidade configurada — o profissional aceita agendamentos em qualquer horário.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{dias.find((d) => d.v === r.dia_semana)?.l}</span>{" "}
                  <span className="text-muted-foreground">{fmtHora(r.hora_inicio)}–{fmtHora(r.hora_fim)}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => del.mutate(r.id)}>Remover</Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
