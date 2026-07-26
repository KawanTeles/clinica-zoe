import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon, Globe } from "lucide-react";
import { AuthSplash } from "@/components/auth-splash";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Painel — Clínica Zoe" },
      { name: "description", content: "Painel administrativo." },
      { property: "og:title", content: "Painel — Clínica Zoe" },
      { property: "og:description", content: "Painel administrativo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppLayout,
});

function AppLayout() {
  const { ready, session, nome, roles, isStaff, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    if (!session || !isStaff) navigate({ to: "/auth", replace: true });
  }, [ready, session, isStaff, navigate]);

  if (!ready || !session || !isStaff) {
    return <AuthSplash message="Preparando seu ambiente..." />;
  }

  const primaryRole = roles[0] ?? "CLIENTE";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-surface-muted">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <a href="/">
                  <Globe className="h-4 w-4" />
                  <span className="hidden sm:inline">Ver Site</span>
                </a>
              </Button>

              <ThemeToggle />
              <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                {primaryRole}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <span className="max-w-[140px] truncate text-sm">{nome ?? session.user.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    {session.user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await signOut();
                      navigate({ to: "/auth", replace: true });
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
