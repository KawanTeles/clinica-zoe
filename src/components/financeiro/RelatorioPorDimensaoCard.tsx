import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl } from "@/lib/financeiro-utils";
import type { FinanceiroDimensao } from "@/lib/financeiro-dashboard";

/** Totais por profissional ou especialidade — reaproveitado nos dois relatórios do Financeiro. */
export function RelatorioPorDimensaoCard({
  title,
  rows,
}: {
  title: string;
  rows: FinanceiroDimensao[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.qtd} lançamento{r.qtd === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    {brl(r.recebido)}
                  </p>
                  {r.aberto > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Em aberto: {brl(r.aberto)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
