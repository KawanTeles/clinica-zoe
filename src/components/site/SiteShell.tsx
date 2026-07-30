import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X, Sparkles, MapPin, Phone, Mail, Stethoscope, UserRound } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { useClinicSettings } from "@/lib/clinic-settings";
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

/** Botões de acesso: mesma altura, mesmo raio, mesmo alinhamento. */
const accessButtonBase =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full px-3.5 xl:px-4 text-sm font-medium whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Paciente: fundo neutro (branco no claro, superfície escura no escuro) + borda suave. */
const patientButton = cn(
  accessButtonBase,
  "border border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary",
);

/** Equipe: cor principal da clínica, destaque premium. */
const clinicButton = cn(
  accessButtonBase,
  "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 hover:shadow-elegant",
);

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

  // Sessões independentes: paciente (site) e equipe (painel).
  const { hasStaffSession, loading: staffSessionLoading } = useStaffSession();
  const resolving = !ready || staffSessionLoading;
  const isClient = ready && !!session;

  // Área do Paciente -> Minha Área quando houver sessão de paciente.
  const patientTo = isClient ? "/cliente" : "/cliente/login";
  const patientLabel = isClient ? "Minha Área" : "Área do Paciente";
  // Área da Clínica: sempre visível, nunca muda de nome.
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
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto]">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <ClinicLogo logoUrl={settings.logo_url} nome={settings.nome} />
            <span className="truncate text-base font-semibold tracking-tight">{settings.nome}</span>
          </Link>

          <nav aria-label="Navegação principal" className="hidden items-center justify-center gap-1 whitespace-nowrap lg:flex">
            {NAV.map((item) => {
              const active =
                item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
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

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0 lg:justify-self-end">
            <ThemeToggle />

            <Link
              to={patientTo}
              aria-label={patientLabel}
              className={cn(
                patientButton,
                "hidden sm:inline-flex",
                resolving && "opacity-70",
              )}
            >
              <UserRound className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{patientLabel}</span>
            </Link>

            {/* Sessões isoladas: navegação entre áreas usa carregamento completo. */}
            <a
              href={staffTo}
              aria-label="Área da Clínica"
              className={cn(clinicButton, "hidden sm:inline-flex")}
            >
              <Stethoscope className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Área da Clínica</span>
            </a>

            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Fechar menu" : "Abrir menu"}
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>


        {open && (
          <div className="border-t border-border bg-background/95 backdrop-blur lg:hidden">
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


              <div className="mt-3 flex flex-col gap-2">
                <Link
                  to={patientTo}
                  aria-label={patientLabel}
                  className={cn(patientButton, "w-full")}
                >
                  <UserRound className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{patientLabel}</span>
                </Link>
                <a href={staffTo} aria-label="Área da Clínica" className={cn(clinicButton, "w-full")}>
                  <Stethoscope className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Área da Clínica</span>
                </a>
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
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
            <span>© {new Date().getFullYear()} {settings.nome}. Todos os direitos reservados.</span>
            <span>
              Feito por{" "}
              <a
                href="https://portfolio-rvm8.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground transition-colors duration-200 hover:text-primary hover:underline decoration-primary/50 underline-offset-4"
              >
                Kawan Teles
              </a>
            </span>
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
