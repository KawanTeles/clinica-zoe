import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { signInGuarded } from "@/lib/auth-login";
import { ForgotPasswordDialog } from "@/components/security/ForgotPasswordDialog";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HeartPulse, Loader2 } from "lucide-react";
import { AuthSplash } from "@/components/auth-splash";

export const Route = createFileRoute("/cliente/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Área do Paciente — Clínica Zoe" },
      { name: "description", content: "Acesse sua área do paciente na Clínica: consultas e mais." },
      { property: "og:title", content: "Área do Paciente — Clínica Zoe" },
      { property: "og:description", content: "Entre na sua área de paciente da Clínica." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClienteLoginPage,
});


const emailSchema = z.string().trim().email("Email inválido").max(255);
const passSchema = z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(100);
const nomeSchema = z.string().trim().min(2, "Informe o nome").max(120);

function ClienteLoginPage() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [tab, setTab] = useState<"login" | "signup">("login");

  useEffect(() => {
    if (!ready || !session) return;
    if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
      navigate({ to: redirect as any, replace: true });
    } else {
      navigate({ to: "/cliente", replace: true });
    }
  }, [ready, session, navigate, redirect]);

  if (!ready || session) {
    return <AuthSplash message={session ? "Entrando..." : "Carregando..."} />;
  }







  return (
    <div className="min-h-screen bg-linear-to-br from-secondary via-background to-surface-muted px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-elegant">
            <HeartPulse className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Clínica</span>
        </Link>

        <div className="w-full rounded-3xl border border-border bg-surface/90 p-6 shadow-elegant backdrop-blur sm:p-8">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Bem-vindo(a)</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">Área do Paciente</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Faça login para acompanhar suas consultas.
            </p>
          </div>



          <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-6">
              <LoginForm />
            </TabsContent>
            <TabsContent value="signup" className="mt-6">
              <SignupForm onDone={() => setTab("login")} />
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Precisa de ajuda?{" "}
          <Link to="/contato" className="font-medium text-primary hover:underline">
            Fale com a clínica
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
    const cleanEmail = email.trim().toLowerCase();
    const result = await signInGuarded("client", cleanEmail, password);
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
        <Label htmlFor="cl-email">Email</Label>
        <Input id="cl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="cl-pass">Senha</Label>
          <ForgotPasswordDialog scope="client" defaultEmail={email} />
        </div>
        <Input id="cl-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" disabled={busy} className="w-full rounded-full">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar
      </Button>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      nomeSchema.parse(nome);
      emailSchema.parse(email);
      passSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.issues[0].message);
        return;
      }
    }
    setBusy(true);
    const cleanEmail = email.trim().toLowerCase();
    const cleanNome = nome.trim();

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/cliente`,
        data: { nome: cleanNome },
      },
    });
    setBusy(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("weak")) {
        toast.error("Senha muito fraca ou comum. Escolha uma senha mais forte (com letras, números e símbolos).");
      } else if (msg.includes("already registered") || msg.includes("already exists")) {
        toast.error("Este e-mail já está cadastrado. Faça login ou recupere sua senha.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    if (data?.session) {
      toast.success("Conta criada com sucesso! Redirecionando...");
    } else if (data?.user && !data.user.email_confirmed_at) {
      toast.success(
        "Conta criada com sucesso! Enviamos um e-mail de confirmação. Por favor, confirme seu e-mail para ativar sua conta antes de fazer login."
      );
      onDone();
    } else {
      toast.success("Conta criada! Você já pode entrar.");
      onDone();
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cs-nome">Nome completo</Label>
        <Input id="cs-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cs-email">Email</Label>
        <Input id="cs-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cs-pass">Senha</Label>
        <Input id="cs-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" disabled={busy} className="w-full rounded-full">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar conta
      </Button>
    </form>
  );
}
