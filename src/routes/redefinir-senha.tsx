import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getSupabaseFor, type AuthScope } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Loader2, KeyRound } from "lucide-react";
import { evaluatePassword } from "@/lib/password";
import { PasswordInput, PasswordStrengthMeter } from "@/components/security/PasswordField";

export const Route = createFileRoute("/redefinir-senha")({
  validateSearch: (search: Record<string, unknown>) => ({
    scope: search.scope === "staff" ? ("staff" as const) : ("client" as const),
  }),
  head: () => ({
    meta: [
      { title: "Redefinir senha — Clínica Zoe" },
      { name: "description", content: "Crie uma nova senha para acessar sua conta na Clínica." },
      { property: "og:title", content: "Redefinir senha — Clínica Zoe" },
      { property: "og:description", content: "Crie uma nova senha com segurança." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RedefinirSenhaPage,
});

function RedefinirSenhaPage() {
  const { scope } = Route.useSearch() as { scope: AuthScope };
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseFor(scope);

    const run = async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        window.history.replaceState({}, "", window.location.pathname + window.location.search);
        if (!cancelled) setStatus(error ? "invalid" : "ready");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!cancelled) setStatus(data.session ? "ready" : "invalid");
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const loginPath = scope === "staff" ? "/auth" : "/cliente/login";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const strength = evaluatePassword(nova);
    if (!strength.valid)
      return toast.error("A senha deve ter 8+ caracteres, com maiúscula, minúscula e número.");
    if (nova !== confirma) return toast.error("A confirmação não confere com a nova senha.");

    setBusy(true);
    const supabase = getSupabaseFor(scope);
    const { error } = await supabase.auth.updateUser({ password: nova });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    await Promise.all([
      getSupabaseFor("staff").auth.signOut(),
      getSupabaseFor("client").auth.signOut(),
    ]);
    setBusy(false);
    toast.success("Senha alterada com sucesso. Entre com sua nova senha.");
    navigate({ to: loginPath, replace: true });
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-secondary via-background to-surface-muted px-4 py-12">
      <div className="mx-auto w-full max-w-md animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-elegant">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Redefinir senha</h1>
          <p className="text-sm text-muted-foreground">Escolha uma nova senha para sua conta.</p>
        </div>

        <div className="rounded-3xl border border-border bg-surface/90 p-6 shadow-elegant backdrop-blur sm:p-8">
          {status === "checking" ? (
            <div className="grid place-items-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : status === "invalid" ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Este link de recuperação é inválido ou já expirou. Solicite um novo link na tela de
                login.
              </p>
              <Button className="rounded-full" onClick={() => navigate({ to: loginPath })}>
                Ir para o login
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <PasswordInput
                id="rp-nova"
                label="Nova senha"
                value={nova}
                onChange={setNova}
                autoComplete="new-password"
              />
              <PasswordInput
                id="rp-conf"
                label="Confirmar nova senha"
                value={confirma}
                onChange={setConfirma}
                autoComplete="new-password"
              />
              <PasswordStrengthMeter value={nova} />
              <Button type="submit" disabled={busy} className="w-full rounded-full">
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar nova senha
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
