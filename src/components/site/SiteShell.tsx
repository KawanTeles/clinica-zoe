import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X, Sparkles, MapPin, Phone, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useClinicSettings, whatsappHref } from "@/lib/clinic-settings";
import { useAvatarUrl } from "@/lib/avatar";
import { useStaffSession } from "@/lib/staff-session";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { to: "/", label: "Início" },
  { to: "/sobre", label: "Sobre" },
  { to: "/especialidades", label: "Especialidades" },
  { to: "/profissionais", label: "Profissionais" },
  { to: "/contato", label: "Contato" },
];

const REDES: { key: string; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "youtube", label: "YouTube" },
  { key: "tiktok", label: "TikTok" },
  { key: "linkedin", label: "LinkedIn" },
];

/** Logo da clínica com fallback no ícone padrão. */
function ClinicLogo({ logoUrl, nome }: { logoUrl: string | null; nome: string }) {
  const url = useAvatarUrl(logoUrl);
  if (url) {
    return (
      <img
        src={url}
        alt={nome}
        className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-soft"
      />
    );
  }
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
      <Sparkles className="h-5 w-5" />
    </div>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, ready } = useAuth();
  const { settings } = useClinicSettings();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // O site público pertence à sessão do paciente (isolada da sessão da equipe).
  const areaTo = ready && session ? "/cliente" : "/cliente/login";
  const areaLabel = ready && session ? "Minha Área" : "Entrar";
  const { hasStaffSession } = useStaffSession();
  const staffTo = hasStaffSession ? "/app" : "/auth";


  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header
        className={cn(
          "sticky top-0 z-40 w-full transition-all duration-300",
          scrolled
            ? "border-b border-border/60 bg-background/80 backdrop-blur-lg shadow-soft"
            : "bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <ClinicLogo logoUrl={settings.logo_url} nome={settings.nome} />
            <span className="truncate text-base font-semibold tracking-tight">{settings.nome}</span>
          </Link>

          <nav className="hidden items-center justify-center gap-1 md:flex">

            {NAV.map((item) => {
              const active =
                item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                  {active && (
                    <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0 md:justify-self-end">
            <ThemeToggle />
            {hasStaffSession && (
              // navegação entre áreas usa carregamento completo (sessões isoladas)
              <a href={staffTo} className="hidden sm:inline-flex">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Painel da equipe
                </Button>
              </a>
            )}
            <Link to={areaTo} className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm">
                {areaLabel}
              </Button>
            </Link>
            <Link to="/agendamento" className="hidden sm:inline-flex">
              <Button size="sm" className="rounded-full px-4 shadow-soft">
                Agendar consulta
              </Button>
            </Link>
            <button
              className="grid h-10 w-10 place-items-center rounded-lg text-foreground md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-border bg-background/95 backdrop-blur md:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
                >
                  {item.label}
                </Link>
              ))}
              <ThemeToggle showLabel className="justify-start px-3" />
              {hasStaffSession && (
                <a
                  href={staffTo}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-secondary"
                >
                  <ShieldCheck className="h-4 w-4" /> Painel da equipe
                </a>
              )}
              <div className="mt-2 flex gap-2">
                <Link to={areaTo} className="flex-1">
                  <Button variant="outline" className="w-full">
                    {areaLabel}
                  </Button>
                </Link>
                <Link to="/agendamento" className="flex-1">
                  <Button className="w-full">Agendar</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-surface-muted">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <ClinicLogo logoUrl={settings.logo_url} nome={settings.nome} />
              <span className="text-base font-semibold">{settings.nome}</span>
            </div>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              {settings.texto_institucional || `${settings.tagline}.`}
            </p>
            {REDES.some((r) => (settings.redes_sociais as any)?.[r.key]) && (
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                {REDES.filter((r) => (settings.redes_sociais as any)?.[r.key]).map((r) => (
                  <a
                    key={r.key}
                    href={(settings.redes_sociais as any)[r.key]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {r.label}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold">Navegação</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {NAV.map((n) => (
                <li key={n.to}>
                  <Link to={n.to} className="hover:text-foreground">{n.label}</Link>
                </li>
              ))}
              <li>
                <a href={staffTo} className="hover:text-foreground">
                  Acesso da equipe
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Contato</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {settings.endereco && (
                <li className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-primary" /><span>{settings.endereco}</span></li>
              )}
              {settings.telefone && (
                <li className="flex gap-2"><Phone className="h-4 w-4 shrink-0 text-primary" /><span>{settings.telefone}</span></li>
              )}
              {settings.email && (
                <li className="flex gap-2"><Mail className="h-4 w-4 shrink-0 text-primary" /><span>{settings.email}</span></li>
              )}
              {settings.whatsapp && (
                <li><a href={whatsappHref(settings)} target="_blank" rel="noreferrer" className="text-primary hover:underline">WhatsApp</a></li>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
            <span>© {new Date().getFullYear()} {settings.nome}. Todos os direitos reservados.</span>
            <span>Feito com cuidado.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}


export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "article" | "li" | "span";
}) {
  const [visible, setVisible] = useState(false);
  const [ref, setRef] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!ref) return;
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );
    io.observe(ref);
    return () => io.disconnect();
  }, [ref]);
  const Component = Tag as any;
  return (
    <Component
      ref={setRef as any}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-all duration-700 ease-out motion-reduce:transition-none",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className,
      )}
    >
      {children}
    </Component>
  );
}
