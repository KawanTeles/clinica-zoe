// Clientes Supabase isolados por área da aplicação.
// A Área do Cliente e o Painel Administrativo mantêm sessões independentes,
// cada uma com sua própria chave de armazenamento (storageKey) no navegador.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type AuthScope = "staff" | "client";

const STORAGE_KEYS: Record<AuthScope, string> = {
  staff: "zoe-auth-staff",
  client: "zoe-auth-client",
};

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createScopedClient(scope: AuthScope): SupabaseClient<Database> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY) },
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      storageKey: STORAGE_KEYS[scope],
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

const cache = new Map<AuthScope, SupabaseClient<Database>>();

export function getSupabaseFor(scope: AuthScope): SupabaseClient<Database> {
  let client = cache.get(scope);
  if (!client) {
    client = createScopedClient(scope);
    cache.set(scope, client);
  }
  return client;
}

/** Área administrativa: /app e /auth. Todo o resto pertence à área do paciente. */
export function scopeForPath(pathname: string): AuthScope {
  if (pathname === "/app" || pathname.startsWith("/app/")) return "staff";
  if (pathname === "/auth" || pathname.startsWith("/auth/")) return "staff";
  return "client";
}

export function currentScope(): AuthScope {
  if (typeof window === "undefined") return "client";
  return scopeForPath(window.location.pathname);
}

/**
 * Cliente Supabase "ambiente-consciente": resolve automaticamente a sessão
 * da área em que o usuário está navegando.
 */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getSupabaseFor(currentScope()) as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});
