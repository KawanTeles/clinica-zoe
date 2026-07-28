import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  TrendingUp,
  Wallet,
  CalendarDays,
  User,
  Stethoscope,
  RotateCcw,
} from "lucide-react";
import { fmtHora } from "@/lib/agenda-utils";
import { PersonAvatar } from "@/lib/avatar";

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Clínica" },
      { name: "description", content: "Painel financeiro." },
      { property: "og:title", content: "Financeiro — Clínica" },
      { property: "og:description", content: "Painel financeiro." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FinanceiroPage,
});

const FORMA_LABEL: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  CARTAO_DEBITO: "Cartão de Débito",
  CARTAO_CREDITO: "Cartão de Crédito",
  OUTRO: "Outro",
};

const STATUS_LABEL: Record<string, string> = {
  ABERTO: "Aberto",
  PAGO: "Pago",
  CANCELADO: "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  ABERTO: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
  PAGO: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  CANCELADO: "bg-muted text-muted-foreground border-border",
};

function firstDayOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function valorLancamento(row: any) {
  const valorCongelado = row?.agendamento?.valor;
  return valorCongelado == null ? Number(row?.valor ?? 0) : Number(valorCongelado) || 0;
}

function FinanceiroPage() {
  const { loading, user, hasRole, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !hasAnyRole(["ADMIN", "PROFISSIONAL"])) {
      navigate({ to: "/app" });
    }
  }, [loading, hasAnyRole, navigate]);

  const isAdmin = hasRole("ADMIN");
  const isProfissional = hasRole("PROFISSIONAL") && !isAdmin;

  // Filters
  const [status, setStatus] = useState<string>("TODOS");
  const [forma, setForma] = useState<string>("TODAS");
  const [profissionalId, setProfissionalId] = useState<string>("TODOS");
  const [especialidadeId, setEspecialidadeId] = useState<string>("TODAS");
  const [dataDe, setDataDe] = useState<string>(firstDayOfMonthISO());
  const [dataAte, setDataAte] = useState<string>(todayISO());

  const [confirmReabrir, setConfirmReabrir] = useState<string | null>(null);

  // Dropdown data
  const { data: profissionais } = useQuery({
    queryKey: ["fin-profissionais"],
    queryFn: async () => {
      const { data } = await supabase.from("profissionais").select("id, nome").order("nome");
      return data ?? [];
    },
    enabled: isAdmin,
  });
  const { data: especialidades } = useQuery({
    queryKey: ["fin-especialidades"],
    queryFn: async () => {
      const { data } = await supabase.from("especialidades").select("id, nome").order("nome");
      return data ?? [];
    },
    enabled: isAdmin,
  });

  // Main list
  const { data: rows, isLoading } = useQuery({
    queryKey: ["financeiro", status, forma, profissionalId, especialidadeId, dataDe, dataAte, isProfissional],
    queryFn: async () => {
      let q = supabase
        .from("financeiro")
        .select(
          "id, valor, status_pagamento, forma_pagamento, pago_em, created_at, agendamento:agendamentos(id, data, hora_inicio, hora_fim, valor), paciente:pacientes(id, nome, foto_url), profissional:profissionais(id, nome, foto_url, especialidade_id, especialidade:especialidades(id, nome))",
        )
        .order("created_at", { ascending: false });
      if (status !== "TODOS") q = q.eq("status_pagamento", status as any);
      if (forma !== "TODAS") q = q.eq("forma_pagamento", forma as any);
      if (profissionalId !== "TODOS") q = q.eq("profissional_id", profissionalId);
      const { data, error } = await q;
      if (error) throw error;
      let list = data ?? [];
      // period filter on consultation date (fallback to created_at when no agendamento)
      list = list.filter((r: any) => {
        const d = r.agendamento?.data ?? (r.created_at ? String(r.created_at).slice(0, 10) : null);
        if (!d) return true;
        if (dataDe && d < dataDe) return false;
        if (dataAte && d > dataAte) return false;
        return true;
      });
      if (especialidadeId !== "TODAS") {
        list = list.filter(
          (r: any) => r.profissional?.especialidade_id === especialidadeId,
        );
      }
      return list;
    },
    enabled: !!user,
  });

  const mut = useMutation({
    mutationFn: async ({ id, novo }: { id: string; novo: "ABERTO" | "PAGO" | "CANCELADO" }) => {
      const patch: any = { status_pagamento: novo };
      patch.pago_em = novo === "PAGO" ? new Date().toISOString() : null;
      const { error } = await supabase.from("financeiro").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      const msg = v.novo === "PAGO" ? "Marcado como pago" : v.novo === "CANCELADO" ? "Lançamento cancelado" : "Reaberto";
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });

  // Stats — over filtered rows
  const stats = useMemo(() => {
    const acc = {
      recebido: 0,
      aberto: 0,
      cancelado: 0,
      mes: 0,
      dia: 0,
      qtdPagas: 0,
      qtdAbertas: 0,
    };
    const hoje = todayISO();
    const mesRef = firstDayOfMonthISO().slice(0, 7);
    for (const r of rows ?? []) {
      const v = valorLancamento(r);
      const s = (r as any).status_pagamento;
      const pagoEm = (r as any).pago_em ? String((r as any).pago_em).slice(0, 10) : null;
      if (s === "PAGO") {
        acc.recebido += v;
        acc.qtdPagas++;
        if (pagoEm && pagoEm.startsWith(mesRef)) acc.mes += v;
        if (pagoEm === hoje) acc.dia += v;
      } else if (s === "ABERTO") {
        acc.aberto += v;
        acc.qtdAbertas++;
      } else if (s === "CANCELADO") {
        acc.cancelado += v;
      }
    }
    return acc;
  }, [rows]);

  // Reports: totals by professional / specialty
  const relatorios = useMemo(() => {
    const porProf = new Map<string, { nome: string; pago: number; aberto: number; qtd: number }>();
    const porEsp = new Map<string, { nome: string; pago: number; aberto: number; qtd: number }>();
    for (const r of rows ?? []) {
      const v = valorLancamento(r);
      const s = (r as any).status_pagamento;
      const prof = (r as any).profissional;
      const esp = (r as any).profissional?.especialidade;
      if (prof) {
        const k = prof.id;
        const cur = porProf.get(k) ?? { nome: prof.nome, pago: 0, aberto: 0, qtd: 0 };
        cur.qtd++;
        if (s === "PAGO") cur.pago += v;
        if (s === "ABERTO") cur.aberto += v;
        porProf.set(k, cur);
      }
      if (esp) {
        const k = esp.id;
        const cur = porEsp.get(k) ?? { nome: esp.nome, pago: 0, aberto: 0, qtd: 0 };
        cur.qtd++;
        if (s === "PAGO") cur.pago += v;
        if (s === "ABERTO") cur.aberto += v;
        porEsp.set(k, cur);
      }
    }
    return {
      profissionais: Array.from(porProf.values()).sort((a, b) => b.pago - a.pago),
      especialidades: Array.from(porEsp.values()).sort((a, b) => b.pago - a.pago),
    };
  }, [rows]);

  const dataLabel = (iso?: string | null) =>
    iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";

  const resetFiltros = () => {
    setStatus("TODOS");
    setForma("TODAS");
    setProfissionalId("TODOS");
    setEspecialidadeId("TODAS");
    setDataDe(firstDayOfMonthISO());
    setDataAte(todayISO());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isProfissional
              ? "Seus recebimentos e valores em aberto."
              : "Controle de recebimentos, lançamentos em aberto e relatórios."}
          </p>
        </div>
        <Button variant="outline" onClick={resetFiltros} className="gap-2">
          <RotateCcw className="h-4 w-4" /> Limpar filtros
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={<CheckCircle2 className="h-5 w-5" />} label="Recebido" value={brl(stats.recebido)} tone="emerald" />
        <KPI icon={<Wallet className="h-5 w-5" />} label="Em aberto" value={brl(stats.aberto)} tone="amber" />
        <KPI icon={<TrendingUp className="h-5 w-5" />} label="Receita do mês" value={brl(stats.mes)} tone="primary" />
        <KPI icon={<DollarSign className="h-5 w-5" />} label="Receita do dia" value={brl(stats.dia)} tone="primary" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat label="Consultas pagas" value={stats.qtdPagas} />
        <MiniStat label="Consultas em aberto" value={stats.qtdAbertas} />
        <MiniStat label="Cancelados (valor)" value={brl(stats.cancelado)} />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-1">
            <label className="mb-1 block text-xs text-muted-foreground">De</label>
            <Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
          </div>
          <div className="lg:col-span-1">
            <label className="mb-1 block text-xs text-muted-foreground">Até</label>
            <Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                <SelectItem value="ABERTO">Aberto</SelectItem>
                <SelectItem value="PAGO">Pago</SelectItem>
                <SelectItem value="CANCELADO">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Forma de pagamento</label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas</SelectItem>
                {Object.entries(FORMA_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Profissional</label>
                <Select value={profissionalId} onValueChange={setProfissionalId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    {profissionais?.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Especialidade</label>
                <Select value={especialidadeId} onValueChange={setEspecialidadeId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas</SelectItem>
                    {especialidades?.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Status tabs shortcut */}
      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="TODOS">Todos</TabsTrigger>
          <TabsTrigger value="ABERTO">Em aberto</TabsTrigger>
          <TabsTrigger value="PAGO">Pagos</TabsTrigger>
          <TabsTrigger value="CANCELADO">Cancelados</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-muted-foreground">
            {rows?.length ?? 0} lançamento{(rows?.length ?? 0) === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (rows?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <DollarSign className="h-5 w-5" />
              </div>
              <p className="text-base font-medium">Nenhum lançamento</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Consultas aprovadas geram automaticamente um lançamento em aberto.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rows?.map((r: any) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-soft transition hover:shadow-elegant md:flex-row md:items-center"
                >
                  <div className="flex w-full items-center gap-3 md:w-auto">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{brl(valorLancamento(r))}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.forma_pagamento ? FORMA_LABEL[r.forma_pagamento] ?? r.forma_pagamento : "Forma não definida"}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <PersonAvatar size="xs" nome={r.paciente?.nome} fotoUrl={r.paciente?.foto_url} />
                        {r.paciente?.nome ?? "Sem paciente"}
                      </span>
                      <Badge variant="outline" className={STATUS_COLOR[r.status_pagamento]}>
                        {STATUS_LABEL[r.status_pagamento]}
                      </Badge>
                    </div>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Stethoscope className="h-3 w-3" />
                        {r.profissional?.nome ?? "—"}
                        {r.profissional?.especialidade?.nome ? ` • ${r.profissional.especialidade.nome}` : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        Consulta: {dataLabel(r.agendamento?.data)}
                        {r.agendamento?.hora_inicio ? ` • ${fmtHora(r.agendamento.hora_inicio)}` : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Pagamento: {r.pago_em ? new Date(r.pago_em).toLocaleDateString("pt-BR") : "—"}
                      </span>
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex w-full flex-wrap gap-2 md:w-auto">
                      {r.status_pagamento === "ABERTO" && (
                        <>
                          <Button
                            className="flex-1 gap-2 md:flex-none"
                            onClick={() => mut.mutate({ id: r.id, novo: "PAGO" })}
                            disabled={mut.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Marcar como pago
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive md:flex-none"
                            onClick={() => mut.mutate({ id: r.id, novo: "CANCELADO" })}
                            disabled={mut.isPending}
                          >
                            <XCircle className="h-4 w-4" /> Cancelar
                          </Button>
                        </>
                      )}
                      {r.status_pagamento === "PAGO" && (
                        <Button
                          variant="outline"
                          className="flex-1 gap-2 md:flex-none"
                          onClick={() => setConfirmReabrir(r.id)}
                          disabled={mut.isPending}
                        >
                          <RotateCcw className="h-4 w-4" /> Reabrir
                        </Button>
                      )}
                      {r.status_pagamento === "CANCELADO" && (
                        <Button
                          variant="outline"
                          className="flex-1 gap-2 md:flex-none"
                          onClick={() => mut.mutate({ id: r.id, novo: "ABERTO" })}
                          disabled={mut.isPending}
                        >
                          <RotateCcw className="h-4 w-4" /> Reabrir
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reports */}
      {isAdmin && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportCard title="Totais por profissional" rows={relatorios.profissionais} />
          <ReportCard title="Totais por especialidade" rows={relatorios.especialidades} />
        </div>
      )}

      <AlertDialog open={!!confirmReabrir} onOpenChange={(o) => !o && setConfirmReabrir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir lançamento pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação exige confirmação administrativa. O lançamento voltará para o status <b>Aberto</b> e a data de pagamento será removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmReabrir) mut.mutate({ id: confirmReabrir, novo: "ABERTO" });
                setConfirmReabrir(null);
              }}
            >
              Confirmar reabertura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KPI({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "emerald" | "amber" | "primary";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "amber"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`grid h-12 w-12 place-items-center rounded-xl ${toneClass}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-lg font-semibold">{value}</span>
      </CardContent>
    </Card>
  );
}

function ReportCard({ title, rows }: { title: string; rows: { nome: string; pago: number; aberto: number; qtd: number }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.nome} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.nome}</p>
                  <p className="text-xs text-muted-foreground">{r.qtd} lançamento{r.qtd === 1 ? "" : "s"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{brl(r.pago)}</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">Aberto: {brl(r.aberto)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
