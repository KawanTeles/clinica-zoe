import { getSupabaseFor, type AuthScope } from "@/lib/supabase";

const GENERIC_ERROR = "Credenciais inválidas";
const DISABLED_ERROR =
  "Esta conta está desativada. Entre em contato com a Clínica para reativá-la.";

/**
 * Login com verificação de status da conta.
 * Contas desativadas ou removidas têm a sessão encerrada imediatamente.
 */
export async function signInGuarded(
  scope: AuthScope,
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const supabase = getSupabaseFor(scope);
  const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
  if (error || !data.user) {
    const msg = error?.message?.toLowerCase() || "";
    if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) {
      return {
        ok: false,
        message: "E-mail não confirmado. Por favor, verifique sua caixa de entrada para confirmar o cadastro antes de entrar.",
      };
    }
    if (msg.includes("invalid login credentials")) {
      return { ok: false, message: "E-mail ou senha incorretos. Verifique suas credenciais." };
    }
    return { ok: false, message: error?.message || GENERIC_ERROR };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ativo, removido_em")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile && (profile.ativo === false || profile.removido_em)) {
    await supabase.auth.signOut();
    return { ok: false, message: DISABLED_ERROR };
  }

  return { ok: true };
}

