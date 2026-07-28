import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PersonAvatar } from "@/lib/avatar";
import { SecurityCard } from "@/components/security/SecurityCard";

export const Route = createFileRoute("/app/conta")({
  head: () => ({
    meta: [
      { title: "Minha Conta — Clínica" },
      { name: "description", content: "Dados da sua conta e segurança de acesso." },
      { property: "og:title", content: "Minha Conta — Clínica" },
      { property: "og:description", content: "Dados da sua conta e segurança de acesso." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContaPage,
});

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  RECEPCIONISTA: "Recepcionista",
  PROFISSIONAL: "Profissional",
  CLIENTE: "Cliente",
};

function ContaPage() {
  const { user, nome, roles } = useAuth();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Minha Conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seus dados de acesso e configurações de segurança.
        </p>
      </div>

      <Card className="border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Dados da conta</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <PersonAvatar nome={nome ?? user?.email} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{nome ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {roles.map((r) => (
                <Badge key={r} variant="secondary">
                  {ROLE_LABEL[r] ?? r}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <SecurityCard className="border-border shadow-soft" />
    </div>
  );
}
