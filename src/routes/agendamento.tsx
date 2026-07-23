import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteShell, Reveal } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  CalendarDays,
  Clock,
  CreditCard,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { addMinutes, fmtHora, todayISO } from "@/lib/agenda-utils";

export const Route = createFileRoute("/agendamento")({
  head: () => ({
    meta: [
      { title: "Agendar consulta — Clínica Zoe" },
      {
        name: "description",
        content:
          "Agende sua consulta na Clínica Zoe em minutos: escolha especialidade, profissional, dia, horário e forma de pagamento.",
      },
      { property: "og:title", content: "Agendar consulta — Clínica Zoe" },
      { property: "og:description", content: "Agende sua consulta em minutos." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/agendamento" }],
  }),
  component: AgendamentoPage,
});

const FORMAS = [
  { value: "PIX", label: "Pix" },
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "CARTAO_DEBITO", label: "Cartão débito" },
  { value: "CARTAO_CREDITO", label: "Cartão crédito" },
] as const;

type FormaPagamento = (typeof FORMAS)[number]["value"];

function AgendamentoPage() {
  const { session, loading, user, nome } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [especialidadeId, setEspecialidadeId] = useState<string>("");
  const [profissionalId, setProfissionalId] = useState<string>("");
  const [data, setData] = useState<string>(todayISO());
  const [hora, setHora] = useState<string>("");
  const [forma, setForma] = useState<FormaPagamento>("PIX");
  const [obs, setObs] = useState("");
  const [telefone, setTelefone] = useState("");
  const [criado, setCriado] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) {
      navigate({
        to: "/auth",
        search: { redirect: "/agendamento" } as any,
      });
    }
  }, [loading, session, navigate]);

  const { data: especialidades } = useQuery({
    queryKey: ["site-agendamento-esp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("especialidades")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profissionais } = useQuery({
    queryKey: ["site-agendamento-prof", especialidadeId],
    queryFn: async () => {
      let q = (supabase as any)
        .from("profissionais_public")
        .select(
          "id, nome, duracao_consulta_min, valor_consulta_avista, valor_consulta_cartao, especialidade_id, especialidade:especialidades(nome)",
        )
        .order("nome");
      if (especialidadeId) q = q.eq("especialidade_id", especialidadeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!especialidadeId,
  });

  const profissional = useMemo(
    () => profissionais?.find((p) => p.id === profissionalId) ?? null,
    [profissionais, profissionalId],
  );

  const { data: slots, isFetching: slotsLoading } = useQuery({
    queryKey: ["site-agendamento-slots", profissionalId, data],
    queryFn: async () => {
      const { data: rows, error } = await supabase.rpc("horarios_disponiveis", {
        p_profissional_id: profissionalId,
        p_data: data,
      });
      if (error) throw error;
      return (rows ?? []) as { hora_inicio: string; hora_fim: string }[];
    },
    enabled: !!profissionalId && !!data,
  });

  const valor = useMemo(() => {
    if (!profissional) return null;
    const isCard = forma === "CARTAO_DEBITO" || forma === "CARTAO_CREDITO";
    return isCard
      ? Number(profissional.valor_consulta_cartao ?? profissional.valor_consulta_avista ?? 0)
      : Number(profissional.valor_consulta_avista ?? profissional.valor_consulta_cartao ?? 0);
  }, [profissional, forma]);

  const criar = useMutation({
    mutationFn: async () => {
      if (!session || !user) throw new Error("Faça login para agendar.");
      if (!profissional) throw new Error("Selecione o profissional.");
      if (!hora) throw new Error("Selecione um horário.");

      const dur = profissional.duracao_consulta_min ?? 30;
      const hora_fim = addMinutes(hora, dur);

      // Cria/atualiza paciente vinculado ao usuário
      const { data: pacExist } = await supabase
        .from("pacientes")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      let paciente_id = pacExist?.id ?? null;
      if (!paciente_id) {
        const { data: novoPac, error: pErr } = await supabase
          .from("pacientes")
          .insert({
            user_id: user.id,
            nome: nome ?? user.email ?? "Cliente",
            email: user.email ?? null,
            telefone: telefone || null,
          })
          .select("id")
          .single();
        if (pErr) throw pErr;
        paciente_id = novoPac.id;
      } else if (telefone) {
        await supabase.from("pacientes").update({ telefone }).eq("id", paciente_id);
      }

      const { data: ag, error } = await supabase
        .from("agendamentos")
        .insert({
          profissional_id: profissional.id,
          paciente_id,
          cliente_user_id: user.id,
          data,
          hora_inicio: hora,
          hora_fim,
          status: "PENDENTE",
          forma_pagamento: forma,
          observacoes: obs || null,
        })
        .select("id")
        .single();

      if (error) throw error;
      return ag.id as string;
    },
    onSuccess: (id) => {
      setCriado(id);
      setStep(5);
      toast.success("Solicitação enviada!");
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível agendar."),
  });

  if (loading || !session) {
    return (
      <SiteShell>
        <div className="grid min-h-[60vh] place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </SiteShell>
    );
  }

  const steps = ["Especialidade", "Profissional", "Data & Hora", "Pagamento", "Confirmação"];

  const canNext = () => {
    if (step === 0) return !!especialidadeId;
    if (step === 1) return !!profissionalId;
    if (step === 2) return !!data && !!hora;
    if (step === 3) return !!forma;
    return true;
  };

  return (
    <SiteShell>
      <section className="border-b border-border bg-gradient-to-br from-secondary via-background to-surface-muted py-14">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Agendamento</p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Marque sua consulta em poucos passos
            </h1>
          </Reveal>
        </div>
      </section>

      <section className="py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          {/* Stepper */}
          <div className="mb-8 grid grid-cols-5 gap-2">
            {steps.map((s, i) => (
              <div key={s} className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-full border text-xs font-semibold transition",
                    i < step
                      ? "border-primary bg-primary text-primary-foreground"
                      : i === step
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "hidden text-center text-[11px] font-medium sm:block",
                    i === step ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s}
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft sm:p-8">
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Escolha a especialidade</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {especialidades?.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        setEspecialidadeId(e.id);
                        setProfissionalId("");
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-4 text-left transition",
                        especialidadeId === e.id
                          ? "border-primary bg-primary/5 shadow-soft"
                          : "border-border bg-surface hover:border-primary/40 hover:bg-secondary/50",
                      )}
                    >
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium">{e.nome}</span>
                    </button>
                  ))}
                  {!especialidades?.length && (
                    <p className="text-sm text-muted-foreground">Nenhuma especialidade cadastrada.</p>
                  )}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Escolha o profissional</h2>
                <div className="grid gap-2">
                  {profissionais?.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setProfissionalId(p.id)}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition",
                        profissionalId === p.id
                          ? "border-primary bg-primary/5 shadow-soft"
                          : "border-border bg-surface hover:border-primary/40 hover:bg-secondary/50",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {(p.especialidade as any)?.nome}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>Duração: {p.duracao_consulta_min ?? 30} min</p>
                        {p.valor_consulta_avista && (
                          <p>
                            {Number(p.valor_consulta_avista).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                  {!profissionais?.length && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum profissional ativo nesta especialidade.
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Escolha o dia e o horário</h2>
                <div className="space-y-2">
                  <Label>Data</Label>
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
                  {slotsLoading ? (
                    <div className="grid place-items-center py-8">
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
                              : "border-border bg-surface hover:border-primary/40 hover:bg-secondary/50",
                          )}
                        >
                          {fmtHora(s.hora_inicio)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-border bg-surface-muted p-4 text-center text-sm text-muted-foreground">
                      Sem horários disponíveis neste dia. Escolha outra data.
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Forma de pagamento e detalhes</h2>
                <div className="space-y-2">
                  <Label>Telefone para contato</Label>
                  <Input
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(11) 99999-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Forma de pagamento</Label>
                  <Select value={forma} onValueChange={(v) => setForma(v as FormaPagamento)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMAS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Observações (opcional)</Label>
                  <Textarea
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder="Alguma informação para o profissional?"
                  />
                </div>
                {profissional && (
                  <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm">
                    <p className="flex items-center gap-2 font-semibold">
                      <CreditCard className="h-4 w-4 text-primary" /> Resumo
                    </p>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      <li>Profissional: <span className="text-foreground">{profissional.nome}</span></li>
                      <li>Data: <span className="text-foreground">{new Date(data + "T00:00:00").toLocaleDateString("pt-BR")}</span></li>
                      <li>Horário: <span className="text-foreground">{hora}</span></li>
                      <li>Valor estimado: <span className="text-foreground">{valor ? valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</span></li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Confirme sua solicitação</h2>
                <div className="rounded-xl border border-border bg-surface-muted p-5 text-sm">
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><span className="text-foreground">{profissional?.nome}</span> — {(profissional?.especialidade as any)?.nome}</li>
                    <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />{new Date(data + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</li>
                    <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />{hora} — {profissional?.duracao_consulta_min ?? 30} min</li>
                    <li className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" />{FORMAS.find((f) => f.value === forma)?.label} — {valor ? valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</li>
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ao confirmar, sua solicitação será enviada como <b>PENDENTE</b> e o profissional
                  aprovará em breve. Você recebe atualização por notificação.
                </p>
              </div>
            )}

            {step === 5 && (
              <div className="py-6 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-xl font-semibold">Solicitação enviada!</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Você receberá a confirmação assim que o profissional aprovar.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Link to="/cliente">
                    <Button className="rounded-full">Ver minhas consultas</Button>
                  </Link>
                  <Link to="/">
                    <Button variant="outline" className="rounded-full">Voltar ao início</Button>
                  </Link>
                </div>
              </div>
            )}

            {step < 5 && (
              <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
                <Button
                  variant="ghost"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                {step < 4 ? (
                  <Button
                    onClick={() => setStep((s) => s + 1)}
                    disabled={!canNext()}
                  >
                    Continuar <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
                    {criar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar solicitação
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
