import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Stethoscope,
  Users,
  CalendarDays,
  DollarSign,
  UserCog,
  Settings,
  Bell,
  ClipboardList,
  UserCircle2,
  ShieldCheck,
  Sparkles,
  MessageSquare,
  Megaphone,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { useSidebarBadges, type SidebarBadges } from "@/lib/sidebar-badges";
import { cn } from "@/lib/utils";

type BadgeKey = keyof SidebarBadges;
type Item = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
  badge?: BadgeKey;
  badgeTone?: "danger" | "warning" | "primary";
};

const items: Item[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, roles: ["ADMIN"] },
  { title: "Configurações", url: "/app/configuracoes", icon: Settings, roles: ["ADMIN"] },
  { title: "Agenda", url: "/app/agenda", icon: CalendarDays, roles: ["ADMIN", "RECEPCIONISTA"], badge: "agenda", badgeTone: "primary" },
  { title: "Pacientes", url: "/app/pacientes", icon: Users, roles: ["ADMIN", "RECEPCIONISTA"] },
  { title: "Financeiro", url: "/app/financeiro", icon: DollarSign, roles: ["ADMIN", "PROFISSIONAL"], badge: "financeiro", badgeTone: "warning" },
  { title: "Profissionais", url: "/app/profissionais", icon: Stethoscope, roles: ["ADMIN"] },
  { title: "Marketing", url: "/app/marketing", icon: Megaphone, roles: ["ADMIN", "RECEPCIONISTA"] },
  { title: "Notificações", url: "/app/notificacoes", icon: Bell, roles: ["ADMIN", "RECEPCIONISTA", "PROFISSIONAL"], badge: "notificacoes", badgeTone: "danger" },
  { title: "WhatsApp", url: "/app/whatsapp", icon: MessageSquare, roles: ["ADMIN", "RECEPCIONISTA"] },
  { title: "Usuários", url: "/app/usuarios", icon: UserCog, roles: ["ADMIN"] },
  { title: "Minha Agenda", url: "/app/minha-agenda", icon: CalendarDays, roles: ["PROFISSIONAL"], badge: "agenda", badgeTone: "primary" },
  { title: "Meus Pacientes", url: "/app/meus-pacientes", icon: Users, roles: ["PROFISSIONAL"] },
  { title: "Solicitações", url: "/app/solicitacoes", icon: ClipboardList, roles: ["ADMIN", "RECEPCIONISTA", "PROFISSIONAL"], badge: "solicitacoes", badgeTone: "danger" },
  { title: "Meu Perfil", url: "/app/meu-perfil", icon: UserCircle2, roles: ["PROFISSIONAL"] },
  { title: "Minha Conta", url: "/app/conta", icon: ShieldCheck, roles: ["ADMIN", "RECEPCIONISTA", "PROFISSIONAL"] },
];

const TONE: Record<NonNullable<Item["badgeTone"]>, string> = {
  danger: "bg-[hsl(0_84%_60%)] text-white",
  warning: "bg-[hsl(38_92%_50%)] text-black/80",
  primary: "bg-primary text-primary-foreground",
};

function CountBadge({ count, tone }: { count: number; tone: NonNullable<Item["badgeTone"]> }) {
  return (
    <span
      aria-label={`${count} pendente(s)`}
      className={cn(
        "ml-auto grid h-5 min-w-[1.25rem] shrink-0 animate-scale-in place-items-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums shadow-sm ring-2 ring-sidebar/60 transition-transform group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:right-1 group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:h-2.5 group-data-[collapsible=icon]:min-w-0 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:text-[0px]",
        TONE[tone],
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}


export function AppSidebar() {
  const { roles } = useAuth();
  const badges = useSidebarBadges();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const visible = items.filter((i) => i.roles.some((r) => roles.includes(r)));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Clínica</p>
            <p className="truncate text-xs text-muted-foreground">Painel administrativo</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => {
                const active =
                  item.url === "/app" ? pathname === "/app" : pathname === item.url || pathname.startsWith(item.url + "/");
                const count = item.badge ? badges[item.badge] : 0;
                return (
                  <SidebarMenuItem key={item.url} className="relative">
                    <SidebarMenuButton asChild isActive={active} tooltip={count > 0 ? `${item.title} (${count})` : item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                        {count > 0 && <CountBadge count={count} tone={item.badgeTone ?? "danger"} />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
