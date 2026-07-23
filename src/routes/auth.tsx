import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Clínica Zoe" },
      { name: "description", content: "Acesse o painel da Clínica Zoe." },
      { property: "og:title", content: "Entrar — Clínica Zoe" },
      { property: "og:description", content: "Acesse o painel da Clínica Zoe." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Email inválido").max(255);
const passSchema = z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(100);
const nomeSchema = z.string().trim().min(2, "Informe o nome").max(120);

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">("login");

  useEffect(() => {
    if (!loading && session) navigate({ to: "/app" });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-surface-muted to-secondary px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Clínica Zoe</span>
        </Link>

        <div className="w-full rounded-2xl border border-border bg-surface p-6 shadow-elegant sm:p-8">
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
          O primeiro cadastro no sistema será o administrador da clínica.
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error("Credenciais inválidas");
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
        <Label htmlFor="l-pass">Senha</Label>
        <Input id="l-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" disabled={busy} className="w-full">
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { nome },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta criada! Você já pode entrar.");
    onDone();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="s-nome">Nome completo</Label>
        <Input id="s-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="s-email">Email</Label>
        <Input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="s-pass">Senha</Label>
        <Input id="s-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" disabled={busy} className="w-full">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar conta
      </Button>
    </form>
  );
}
