import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { getSupabaseFor, scopeForPath, type AuthScope } from "@/lib/supabase";

export type AppRole = "ADMIN" | "RECEPCIONISTA" | "PROFISSIONAL" | "CLIENTE";

const STAFF_ROLES: AppRole[] = ["ADMIN", "RECEPCIONISTA", "PROFISSIONAL"];

interface AuthState {
  /** área ativa: "staff" (/app, /auth) ou "client" (site público e /cliente) */
  scope: AuthScope;
  /** true enquanto a sessão inicial ainda está sendo lida */
  loading: boolean;
  /** true somente quando sessão E papéis já foram resolvidos (nenhuma tela deve renderizar antes) */
  ready: boolean;
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  nome: string | null;
  isStaff: boolean;
  /** rota de destino conforme os papéis do usuário */
  homePath: "/app" | "/cliente";
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const scope = scopeForPath(pathname);

  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [nome, setNome] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const routerRef = useRef(useRouter());

  useEffect(() => {
    const supabase = getSupabaseFor(scope);
    let currentUserId: string | null = null;
    let cancelled = false;

    // troca de área: recomeça a leitura da sessão daquela área
    setSession(null);
    setRoles([]);
    setNome(null);
    setRolesLoaded(false);
    setLoading(true);

    const loadProfile = async (uid: string) => {
      const [{ data: rolesData }, { data: profileData }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("profiles").select("nome").eq("id", uid).maybeSingle(),
      ]);
      if (cancelled) return;
      setRoles((rolesData?.map((r) => r.role as AppRole)) ?? []);
      setNome(profileData?.nome ?? null);
      setRolesLoaded(true);
    };

    // Listener FIRST, then read session
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return;
      setSession(s);
      if (s?.user) {
        const changed = currentUserId !== s.user.id;
        currentUserId = s.user.id;
        if (changed) {
          setRolesLoaded(false);
          setRoles([]);
          setNome(null);
          setTimeout(() => {
            if (!cancelled) loadProfile(s.user.id).finally(() => !cancelled && setLoading(false));
          }, 0);
        }
      } else {
        currentUserId = null;
        setRoles([]);
        setNome(null);
        setRolesLoaded(false);
        setLoading(false);
      }
      routerRef.current.invalidate();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user) {
        currentUserId = data.session.user.id;
        loadProfile(data.session.user.id).finally(() => !cancelled && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [scope]);

  const isStaff = STAFF_ROLES.some((r) => roles.includes(r));
  const ready = !loading && (!session || rolesLoaded);

  const value: AuthState = {
    scope,
    loading,
    ready,
    session,
    user: session?.user ?? null,
    roles,
    nome,
    isStaff,
    homePath: isStaff ? "/app" : "/cliente",
    hasRole: (r) => roles.includes(r),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
    signOut: async () => {
      // encerra apenas a sessão da área atual
      await getSupabaseFor(scope).auth.signOut();
    },
    refresh: async () => {
      if (session?.user) {
        const supabase = getSupabaseFor(scope);
        const uid = session.user.id;
        const [{ data: rolesData }, { data: profileData }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", uid),
          supabase.from("profiles").select("nome").eq("id", uid).maybeSingle(),
        ]);
        setRoles((rolesData?.map((r) => r.role as AppRole)) ?? []);
        setNome(profileData?.nome ?? null);
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
