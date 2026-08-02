import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Users, CalendarDays, Phone, Mail, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { PersonAvatar } from "@/lib/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STATUS_COLOR, STATUS_LABEL, fmtHora, todayISO } from "@/lib/agenda-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/meus-pacientes")({
  head: () => ({
    meta: [
      { title: "Meus Pacientes — Clínica Zoe" },
      { name: "description", content: "Seus pacientes." },
      { property: "og:title", content: "Meus Pacientes — Clínica Zoe" },
      { property: "og:description", content: "Seus pacientes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MeusPacientesPage,
});

type PacienteRow = {
  id: string;
  nome: string;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  data_nascimento: string | null;
  foto_url: string | null;
  observacoes: string | null;
};

type Consulta = {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  valor: number | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  paciente: PacienteRow | null;
};

type Agrupado = {
  paciente: PacienteRow;
  consultas: Consulta[];
  ultima: Consulta | null;
  proxima: Consulta | null;
};

function idade(nascimento?: string | null) {
  if (!nascimento) return null;
  const nasc = new Date(nascimento + "T00:00:00");
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
  return anos >= 0 ? anos : null;
}

function fmtData(d?: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

function somenteDigitos(v?: string | null) {
  return (v ?? "").replace(/\D/g, "");
}

function MeusPacientesPage() {
  const { user } = useAuth();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<Agrupado | null>(null);

  const { data: prof, isLoading: profLoading } = useQuery({
    queryKey: ["meu-profissional", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, nome")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: consultas, isLoading } = useQuery({
    queryKey: ["meus-pacientes-consultas", prof?.id],
    enabled: !!prof?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(
          "id, data, hora_inicio, hora_fim, status, valor, forma_pagamento, observacoes, paciente:pacientes(id, nome, telefone, whatsapp, email, data_nascimento, foto_url, observacoes)",
        )
        .eq("profissional_id", prof!.id)
        .order("data", { ascending: false })
        .order("hora_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Consulta[];
    },
  });

  const agrupados = useMemo<Agrupado[]>(() => {
    const hoje = todayISO();
    const mapa = new Map<string, Agrupado>();
    for (const c of consultas ?? []) {
      if (!c.paciente) continue;
      const atual = mapa.get(c.paciente.id) ?? {
        paciente: c.paciente,
        consultas: [],
        ultima: null,
        proxima: null,
      };
      atual.consultas.push(c);
      mapa.set(c.paciente.id, atual);
    }
    for (const g of mapa.values()) {
      const validas = g.consultas.filter((c) => c.status !== "CANCELADO" && c.status !== "RECUSADO");
      g.ultima = validas.find((c) => c.data < hoje) ?? null;
      const futuras = validas.filter((c) => c.data >= hoje);
      g.proxima = futuras.length ? futuras[futuras.length - 1] : null;
    }
    return [...mapa.values()].sort((a, b) => a.paciente.nome.localeCompare(b.paciente.nome, "pt-BR"));
  }, [consultas]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return agrupados;
    const digitos = somenteDigitos(termo);
    return agrupados.filter((g) => {
      const p = g.paciente;
      if (p.nome.toLowerCase().includes(termo)) return true;
      if (p.email?.toLowerCase().includes(termo)) return true;
      if (digitos.length >= 3) {
        if (somenteDigitos(p.telefone).includes(digitos)) return true;
        if (somenteDigitos(p.whatsapp).includes(digitos)) return true;
      }
      return false;
    });
  }, [agrupados, busca]);

  if (profLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!prof) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Seu usuário ainda não está vinculado a um profissional. Peça ao administrador para vincular.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Pacientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pacientes que já foram atendidos ou têm consulta agendada com você.
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail"
            className="pl-9"
            aria-label="Buscar paciente"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{agrupados.length}</p>
              <p className="text-xs text-muted-foreground">Pacientes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">
                {agrupados.filter((g) => g.proxima).length}
              </p>
              <p className="text-xs text-muted-foreground">Com consulta futura</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{consultas?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Atendimentos registrados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de pacientes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid place-items-center py-14">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : filtrados.length ? (
            <ul className="divide-y divide-border">
              {filtrados.map((g) => {
                const anos = idade(g.paciente.data_nascimento);
                return (
                  <li key={g.paciente.id}>
                    <button
                      onClick={() => setAberto(g)}
                      className="flex w-full flex-col gap-3 rounded-lg px-1 py-4 text-left transition hover:bg-secondary/50 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <PersonAvatar nome={g.paciente.nome} fotoUrl={g.paciente.foto_url} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{g.paciente.nome}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {g.paciente.telefone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {g.paciente.telefone}
                            </span>
                          )}
                          {g.paciente.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {g.paciente.email}
                            </span>
                          )}
                          {anos !== null && <span>{anos} anos</span>}
                        </p>
                      </div>
                      <div className="grid gap-1 text-xs text-muted-foreground sm:text-right">
                        <span>
                          Última: <span className="text-foreground">{fmtData(g.ultima?.data)}</span>
                        </span>
                        <span>
                          Próxima: <span className="text-foreground">{fmtData(g.proxima?.data)}</span>
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-14 text-center text-sm text-muted-foreground">
              {busca
                ? "Nenhum paciente encontrado para esta busca."
                : "Você ainda não possui pacientes vinculados a atendimentos."}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico do paciente</DialogTitle>
          </DialogHeader>
          {aberto && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <PersonAvatar nome={aberto.paciente.nome} fotoUrl={aberto.paciente.foto_url} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{aberto.paciente.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {[
                      aberto.paciente.telefone,
                      aberto.paciente.email,
                      idade(aberto.paciente.data_nascimento) !== null
                        ? `${idade(aberto.paciente.data_nascimento)} anos`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sem dados de contato"}
                  </p>
                </div>
              </div>

              {aberto.paciente.observacoes && (
                <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm">
                  <p className="font-medium">Observações do cadastro</p>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">
                    {aberto.paciente.observacoes}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Consultas ({aberto.consultas.length})</p>
                <ul className="space-y-2">
                  {aberto.consultas.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-xl border border-border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {fmtData(c.data)} · {fmtHora(c.hora_inicio)}–{fmtHora(c.hora_fim)}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            STATUS_COLOR[c.status] ?? "border-border text-muted-foreground",
                          )}
                        >
                          {STATUS_LABEL[c.status] ?? c.status}
                        </span>
                      </div>
                      {(c.valor || c.observacoes) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {c.valor
                            ? Number(c.valor).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })
                            : null}
                          {c.valor && c.observacoes ? " · " : ""}
                          {c.observacoes}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setAberto(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
