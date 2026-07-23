export const DIAS_SEMANA = [
  { value: 0, label: "Domingo", short: "Dom" },
  { value: 1, label: "Segunda", short: "Seg" },
  { value: 2, label: "Terça", short: "Ter" },
  { value: 3, label: "Quarta", short: "Qua" },
  { value: 4, label: "Quinta", short: "Qui" },
  { value: 5, label: "Sexta", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
];

export const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  RECUSADO: "Recusado",
  CANCELADO: "Cancelado",
  REMARCADO: "Remarcado",
  FINALIZADO: "Finalizado",
};

export const STATUS_COLOR: Record<string, string> = {
  PENDENTE: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
  APROVADO: "bg-primary/15 text-primary border-primary/30",
  RECUSADO: "bg-destructive/15 text-destructive border-destructive/30",
  CANCELADO: "bg-muted text-muted-foreground border-border",
  REMARCADO: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300",
  FINALIZADO: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
};

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function addMinutes(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export function fmtHora(t: string) {
  return t?.slice(0, 5) ?? "";
}
