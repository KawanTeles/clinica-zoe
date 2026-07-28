import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ user_id: z.string().uuid() });
const setActiveSchema = z.object({ user_id: z.string().uuid(), ativo: z.boolean() });

export type AdminUserRow = {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  foto_url: string | null;
  roles: string[];
  ativo: boolean;
  removido_em: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin, loadUsers } = await import("@/lib/users.server");
    await assertAdmin(context.supabase, context.userId);
    return loadUsers();
  });

export const adminSetUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof setActiveSchema>) => setActiveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertAdmin, setUserActive } = await import("@/lib/users.server");
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Você não pode desativar a sua própria conta.");
    }
    return setUserActive(context.userId, data.user_id, data.ativo);
  });

export const adminRemoveUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof idSchema>) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertAdmin, removeUser } = await import("@/lib/users.server");
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Você não pode remover a sua própria conta.");
    }
    return removeUser(context.userId, data.user_id);
  });

export const adminListAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_audit_log")
      .select("id, actor_nome, target_nome, acao, detalhes, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
