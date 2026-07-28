import { useState } from "react";
import { toast } from "sonner";
import { getSupabaseFor } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import { evaluatePassword } from "@/lib/password";
import { PasswordInput, PasswordStrengthMeter } from "@/components/security/PasswordField";

/** Seção "Segurança": alteração da própria senha (todos os perfis). */
export function SecurityCard({ className }: { className?: string }) {
  const { scope, user } = useAuth();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    const strength = evaluatePassword(nova);
    if (!atual) return toast.error("Informe sua senha atual.");
    if (!strength.valid)
      return toast.error("A nova senha deve ter 8+ caracteres, com maiúscula, minúscula e número.");
    if (nova !== confirma) return toast.error("A confirmação não confere com a nova senha.");
    if (nova === atual) return toast.error("A nova senha deve ser diferente da atual.");

    setBusy(true);
    const supabase = getSupabaseFor(scope);
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: atual,
    });
    if (reauthError) {
      setBusy(false);
      toast.error("Senha atual incorreta.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: nova });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAtual("");
    setNova("");
    setConfirma("");
    toast.success("Senha alterada com sucesso.");
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </span>
          Segurança
        </CardTitle>
        <CardDescription>Altere a senha da sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <PasswordInput
              id="sec-atual"
              label="Senha atual"
              value={atual}
              onChange={setAtual}
              autoComplete="current-password"
            />
          </div>
          <PasswordInput
            id="sec-nova"
            label="Nova senha"
            value={nova}
            onChange={setNova}
            autoComplete="new-password"
          />
          <PasswordInput
            id="sec-conf"
            label="Confirmar nova senha"
            value={confirma}
            onChange={setConfirma}
            autoComplete="new-password"
          />
          <div className="sm:col-span-2">
            <PasswordStrengthMeter value={nova} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy} className="rounded-full">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Alterar senha
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
