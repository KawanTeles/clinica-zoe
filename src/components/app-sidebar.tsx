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
  Sparkles,
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

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; roles: AppRole[] };

const items: Item[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, roles: ["ADMIN"] },
  { title: "Profissionais", url: "/app/profissionais", icon: Stethoscope, roles: ["ADMIN"] },
  { title: "Pacientes", url: "/app/pacientes", icon: Users, roles: ["ADMIN", "RECEPCIONISTA"] },
  { title: "Agenda", url: "/app/agenda", icon: CalendarDays, roles: ["ADMIN", "RECEPCIONISTA"] },
  { title: "Financeiro", url: "/app/financeiro", icon: DollarSign, roles: ["ADMIN"] },
  { title: "Usuários", url: "/app/usuarios", icon: UserCog, roles: ["ADMIN"] },
  { title: "Configurações", url: "/app/configuracoes", icon: Settings, roles: ["ADMIN"] },
  { title: "Notificações", url: "/app/notificacoes", icon: Bell, roles: ["RECEPCIONISTA"] },
  { title: "Minha Agenda", url: "/app/minha-agenda", icon: CalendarDays, roles: ["PROFISSIONAL"] },
  { title: "Meus Pacientes", url: "/app/meus-pacientes", icon: Users, roles: ["PROFISSIONAL"] },
  { title: "Solicitações", url: "/app/solicitacoes", icon: ClipboardList, roles: ["PROFISSIONAL"] },
  { title: "Meu Perfil", url: "/app/meu-perfil", icon: UserCircle2, roles: ["PROFISSIONAL"] },
];

export function AppSidebar() {
  const { roles } = useAuth();
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
            <p className="truncate text-sm font-semibold">Clínica Zoe</p>
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
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
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
