import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

export function ComingSoon({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <CalendarDays className="h-6 w-6" />
          </div>
          <p className="text-base font-medium">Em construção</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Esta seção será liberada nas próximas etapas do painel. A base de dados já está pronta.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
