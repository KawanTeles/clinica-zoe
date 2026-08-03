import { Card, CardContent } from "@/components/ui/card";
import {
  DollarSign,
  Wallet,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Receipt,
  Loader2,
  Ticket,
} from "lucide-react";
import { brl } from "@/lib/financeiro-utils";
import { useFinanceiroDashboard } from "@/lib/financeiro-dashboard";

type Tone = "primary" | "emerald" | "amber" | "blue" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  muted: "bg-muted text-muted-foreground",
};

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: Tone;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${TONE_CLASS[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-semibold">{value}</p>
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/** Grade de indicadores do Dashboard Financeiro (Fase 1). */
export function FinanceiroKpis() {
  const { data, isLoading } = useFinanceiroDashboard();

  if (isLoading) {
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const variacaoLabel =
    data.variacaoMesPct == null
      ? undefined
      : `${data.variacaoMesPct >= 0 ? "+" : ""}${data.variacaoMesPct.toFixed(1)}% vs. mês anterior`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={DollarSign} label="Receita do dia" value={brl(data.receitaDia)} tone="primary" />
        <Kpi
          icon={CalendarDays}
          label="Receita da semana"
          value={brl(data.receitaSemana)}
          tone="primary"
        />
        <Kpi
          icon={data.variacaoMesPct != null && data.variacaoMesPct < 0 ? TrendingDown : TrendingUp}
          label="Receita do mês"
          value={brl(data.receitaMes)}
          tone="primary"
          hint={variacaoLabel}
        />
        <Kpi
          icon={CalendarRange}
          label="Receita do ano"
          value={brl(data.receitaAno)}
          tone="primary"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Wallet}
          label="Em aberto"
          value={brl(data.totalAberto)}
          tone="amber"
          hint={`${data.qtdAberto} lançamento(s)`}
        />
        <Kpi
          icon={CalendarClock}
          label="Parcial"
          value={brl(data.totalParcial)}
          tone="blue"
          hint={`${data.qtdParcial} lançamento(s)`}
        />
        <Kpi
          icon={Ticket}
          label="Ticket médio (ano)"
          value={brl(data.ticketMedio)}
          tone="emerald"
        />
        <Kpi
          icon={Receipt}
          label="Consultas pagas (ano)"
          value={String(data.totalConsultasPagasAno)}
          tone="muted"
        />
      </div>
    </div>
  );
}
