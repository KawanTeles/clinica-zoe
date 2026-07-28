import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AdminUserRow } from "@/lib/users.functions";

export async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "ADMIN")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão");
  if (!data) throw new Error("Somente administradores podem executar esta ação");
}

async function nomeDe(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("profiles").select("nome").eq("id", userId).maybeSingle();
  return data?.nome ?? null;
}

async function registrarAuditoria(params: {
  actorId: string;
  targetId: string;
  acao: string;
  detalhes?: string | null;
}) {
  const [actorNome, targetNome] = await Promise.all([
    nomeDe(params.actorId),
    nomeDe(params.targetId),
  ]);
  await supabaseAdmin.from("user_audit_log").insert({
    actor_id: params.actorId,
    actor_nome: actorNome,
    target_user_id: params.targetId,
    target_nome: targetNome,
    acao: params.acao,
    detalhes: params.detalhes ?? null,
  });
}

export async function loadUsers(): Promise<AdminUserRow[]> {
  const [{ data: profiles, error }, { data: userRoles }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, nome, email, telefone, foto_url, ativo, removido_em, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("user_roles").select("user_id, role"),
  ]);
  if (error) throw new Error(error.message);

  const roleMap = new Map<string, string[]>();
  (userRoles ?? []).forEach((r: any) => {
    const arr = roleMap.get(r.user_id) ?? [];
    arr.push(r.role);
    roleMap.set(r.user_id, arr);
  });

  const lastSignIn = new Map<string, string | null>();
  try {
    let page = 1;
    for (;;) {
      const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      const users = data?.users ?? [];
      users.forEach((u) => lastSignIn.set(u.id, u.last_sign_in_at ?? null));
      if (users.length < 1000) break;
      page += 1;
      if (page > 10) break;
    }
  } catch {
    // último acesso é informação opcional
  }

  return (profiles ?? []).map((p: any) => ({
    id: p.id,
    nome: p.nome,
    email: p.email,
    telefone: p.telefone,
    foto_url: p.foto_url,
    roles: roleMap.get(p.id) ?? [],
    ativo: p.ativo !== false,
    removido_em: p.removido_em,
    created_at: p.created_at,
    last_sign_in_at: lastSignIn.get(p.id) ?? null,
  }));
}

const BAN_FOREVER = "876000h";

export async function setUserActive(actorId: string, targetId: string, ativo: boolean) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update(
      ativo
        ? { ativo: true, desativado_em: null, desativado_por: null }
        : { ativo: false, desativado_em: new Date().toISOString(), desativado_por: actorId },
    )
    .eq("id", targetId);
  if (error) throw new Error(error.message);

  // Bloqueia/libera o login imediatamente
  await supabaseAdmin.auth.admin.updateUserById(targetId, {
    ban_duration: ativo ? "none" : BAN_FOREVER,
  } as any);

  // Profissional desativado sai do site público e de novos agendamentos
  await supabaseAdmin
    .from("profissionais")
    .update({ status: ativo ? "ATIVO" : "INATIVO" })
    .eq("user_id", targetId);

  await registrarAuditoria({
    actorId,
    targetId,
    acao: ativo ? "USUARIO_REATIVADO" : "USUARIO_DESATIVADO",
    detalhes: ativo
      ? "Conta reativada; acesso liberado."
      : "Conta desativada; login bloqueado e histórico preservado.",
  });

  return { ok: true };
}

/**
 * Remoção segura (soft delete): nenhum registro histórico é apagado.
 * Agendamentos, financeiro e notificações permanecem intactos; o usuário é
 * apenas marcado como removido e desvinculado dos cadastros operacionais.
 */
export async function removeUser(actorId: string, targetId: string) {
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ ativo: false, removido_em: now, removido_por: actorId })
    .eq("id", targetId);
  if (error) throw new Error(error.message);

  // Bloqueia o acesso definitivamente
  await supabaseAdmin.auth.admin.updateUserById(targetId, { ban_duration: BAN_FOREVER } as any);

  // Revoga permissões do painel
  await supabaseAdmin.from("user_roles").delete().eq("user_id", targetId);

  // Desvincula cadastros preservando o histórico
  await supabaseAdmin
    .from("profissionais")
    .update({ status: "INATIVO", user_id: null })
    .eq("user_id", targetId);
  await supabaseAdmin.from("pacientes").update({ user_id: null }).eq("user_id", targetId);

  await registrarAuditoria({
    actorId,
    targetId,
    acao: "USUARIO_REMOVIDO",
    detalhes:
      "Remoção segura: acesso revogado e cadastros desvinculados. Consultas, financeiro e notificações preservados.",
  });

  return { ok: true };
}

export async function registrarAuditoriaExterna(params: {
  actorId: string;
  targetId: string;
  acao: string;
  detalhes?: string | null;
}) {
  await registrarAuditoria(params);
}
