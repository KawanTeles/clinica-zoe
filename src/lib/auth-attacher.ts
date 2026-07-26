import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase";

// Anexa o bearer token da sessão da área atual (equipe ou paciente) às chamadas de serverFn.
export const attachScopedSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);
