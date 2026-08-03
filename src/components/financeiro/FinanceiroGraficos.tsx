import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Loader2 } from "lucide-react";
import { useFinanceiroDashboard, useFinanceiroEvolucaoMensal } from "@/lib/financeiro-dashboard";

const PIE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const evolucaoConfig: ChartConfig = {
  recebido: { label: "Recebido", color: "var(--color-chart-1)" },
  aberto: { label: "Em aberto", color: "var(--color-chart-4)" },
};

const profissionalConfig: ChartConfig = {
  recebido: { label: "Recebido", color: "var(--color-chart-1)" },
};

function mesLabel(iso: string) {
  const [ano, mes] = iso.split("-");
  return new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString("pt-BR", { month: "short" });
}

/** Gráficos do Dashboard Financeiro (Fase 1): evolução mensal, receita por profissional e por especialidade. */
export function FinanceiroGraficos() {
  const { data: dash, isLoading: loadingDash } = useFinanceiroDashboard();
  const { data: evolucao, isLoading: loadingEvolucao } = useFinanceiroEvolucaoMensal(12);

  const porProfissionalTop = dash.porProfissional.slice(0, 8);
  const porEspecialidade = dash.porEspecialidade.filter((e) => e.recebido > 0).slice(0, 6);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Evolução mensal (últimos 12 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingEvolucao ? (
            <div className="grid place-items-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !evolucao?.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Sem histórico suficiente ainda.
            </p>
          ) : (
            <ChartContainer config={evolucaoConfig} className="aspect-auto h-64 w-full">
              <LineChart data={evolucao} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="mes" tickFormatter={mesLabel} tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={48} />
                <ChartTooltip
                  content={<ChartTooltipContent labelFormatter={(v) => mesLabel(String(v))} />}
                />
                <Line
                  type="monotone"
                  dataKey="recebido"
                  stroke="var(--color-recebido)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="aberto"
                  stroke="var(--color-aberto)"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 4"
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receita por profissional</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDash ? (
            <div className="grid place-items-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !porProfissionalTop.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <ChartContainer config={profissionalConfig} className="aspect-auto h-64 w-full">
              <BarChart data={porProfissionalTop} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="nome"
                  tickLine={false}
                  axisLine={false}
                  width={100}
                  tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 14)}…` : v)}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="recebido" fill="var(--color-recebido)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receita por especialidade</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDash ? (
            <div className="grid place-items-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !porEspecialidade.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <ChartContainer config={{}} className="aspect-auto h-64 w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="nome" hideLabel />} />
                <Pie
                  data={porEspecialidade}
                  dataKey="recebido"
                  nameKey="nome"
                  innerRadius={48}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {porEspecialidade.map((entry, index) => (
                    <Cell key={entry.id} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
