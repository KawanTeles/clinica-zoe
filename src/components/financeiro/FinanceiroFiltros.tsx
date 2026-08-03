import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, RotateCcw, Search } from "lucide-react";
import { FORMA_PAGAMENTO_LABEL } from "@/lib/financeiro-utils";

export type FinanceiroFiltrosState = {
  status: string;
  forma: string;
  profissionalId: string;
  especialidadeId: string;
  dataDe: string;
  dataAte: string;
  busca: string;
};

type Props = {
  filtros: FinanceiroFiltrosState;
  onChange: <K extends keyof FinanceiroFiltrosState>(
    campo: K,
    valor: FinanceiroFiltrosState[K],
  ) => void;
  onReset: () => void;
  onExport: () => void;
  isAdmin: boolean;
  profissionais: { id: string; nome: string }[];
  especialidades: { id: string; nome: string }[];
};

/** Barra de filtros do Financeiro: período, status, forma de pagamento, profissional/especialidade (ADMIN) e busca livre. */
export function FinanceiroFiltros({
  filtros,
  onChange,
  onReset,
  onExport,
  isAdmin,
  profissionais,
  especialidades,
}: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base">Filtros</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={onReset} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Limpar filtros
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs text-muted-foreground">Buscar</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Paciente, profissional ou observações"
              value={filtros.busca}
              onChange={(e) => onChange("busca", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">De</label>
          <Input
            type="date"
            value={filtros.dataDe}
            onChange={(e) => onChange("dataDe", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Até</label>
          <Input
            type="date"
            value={filtros.dataAte}
            onChange={(e) => onChange("dataAte", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Status</label>
          <Select value={filtros.status} onValueChange={(v) => onChange("status", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos</SelectItem>
              <SelectItem value="ABERTO">Aberto</SelectItem>
              <SelectItem value="PARCIAL">Parcial</SelectItem>
              <SelectItem value="PAGO">Pago</SelectItem>
              <SelectItem value="CANCELADO">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Forma de pagamento</label>
          <Select value={filtros.forma} onValueChange={(v) => onChange("forma", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas</SelectItem>
              {Object.entries(FORMA_PAGAMENTO_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Profissional</label>
              <Select
                value={filtros.profissionalId}
                onValueChange={(v) => onChange("profissionalId", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  {profissionais.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Especialidade</label>
              <Select
                value={filtros.especialidadeId}
                onValueChange={(v) => onChange("especialidadeId", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  {especialidades.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
