import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { signInGuarded } from "@/lib/auth-login";
import { ForgotPasswordDialog } from "@/components/security/ForgotPasswordDialog";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2 } from "lucide-react";
import { AuthSplash } from "@/components/auth-splash";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Painel da Equipe — Clínica Zoe" },
      { name: "description", content: "Acesso restrito à equipe da Clínica." },
      { property: "og:title", content: "Painel da Equipe — Clínica Zoe" },
      { property: "og:description", content: "Acesso restrito à equipe da Clínica." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Email inválido").max(255);
const passSchema = z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(100);

function AuthPage() {
  const { session, ready, isStaff, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready || !session) return;
    if (isStaff) {
      navigate({ to: "/app", replace: true });
    } else {
      // conta sem acesso administrativo: encerra apenas a sessão do painel
      void signOut().then(() => toast.error("Esta conta não tem acesso ao painel da equipe."));
    }
  }, [ready, session, isStaff, signOut, navigate]);

  if (!ready || (session && isStaff)) {
    return <AuthSplash message={session ? "Entrando..." : "Carregando..."} />;
  }


  return (
    <div className="min-h-screen bg-linear-to-br from-background via-surface-muted to-background px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-dark text-primary-foreground shadow-soft">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Clínica</span>
        </Link>

        <div className="w-full rounded-xl border border-border bg-surface p-6 shadow-soft sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-dark">
              Acesso restrito
            </p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">Painel da Equipe</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Área exclusiva para administradores, recepção e profissionais.
            </p>
          </div>
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          É paciente?{" "}
          <Link to="/cliente/login" search={{ redirect: undefined }} className="font-medium text-primary hover:underline">
            Acessar Área do Paciente
          </Link>
        </p>
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.issues[0].message);
        return;
      }
    }
    setBusy(true);
    const result = await signInGuarded("staff", email, password);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Bem-vindo(a)!");
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="l-email">Email</Label>
        <Input id="l-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="l-pass">Senha</Label>
          <ForgotPasswordDialog scope="staff" defaultEmail={email} />
        </div>
        <Input id="l-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" disabled={busy} className="w-full">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar
      </Button>
    </form>
  );
}
