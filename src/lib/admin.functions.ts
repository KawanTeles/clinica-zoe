import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "@/lib/auth-context";

const createUserSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  senha: z.string().min(6).max(100),
  telefone: z.string().trim().max(30).optional().nullable(),
  whatsapp: z.string().trim().max(30).optional().nullable(),

  role: z.enum(["ADMIN", "RECEPCIONISTA", "PROFISSIONAL", "CLIENTE"]),
  profissional: z
    .object({
      especialidade_id: z.string().uuid().nullable().optional(),
      registro_profissional: z.string().max(60).optional().nullable(),
      descricao: z.string().max(1000).optional().nullable(),
      formacao: z.string().max(300).optional().nullable(),
      anos_experiencia: z.number().int().min(0).max(80).optional().nullable(),
      valor_consulta_avista: z.number().nonnegative().default(0),
      valor_consulta_cartao: z.number().nonnegative().default(0),
      duracao_consulta_min: z.number().int().positive().default(60),
      foto_url: z.string().max(500).optional().nullable(),
    })
    .optional()
    .nullable(),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "ADMIN")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão");
  if (!data) throw new Error("Somente administradores podem executar esta ação");
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof createUserSchema>) => createUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome, telefone: data.telefone ?? null },
    });
    if (createErr || !created?.user) {
      throw new Error(createErr?.message ?? "Falha ao criar usuário");
    }
    const newUserId = created.user.id;

    // Ajusta role para o solicitado (trigger cria CLIENTE por default)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: data.role as AppRole });
    if (roleErr) throw new Error(roleErr.message);

    // Garante profile atualizado
    await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newUserId,
        nome: data.nome,
        email: data.email,
        telefone: data.telefone ?? null,
        foto_url: data.profissional?.foto_url ?? null,
        criado_por: context.userId,
      });

    let profissionalId: string | null = null;
    if (data.role === "PROFISSIONAL") {
      const p = data.profissional ?? {
        valor_consulta_avista: 0,
        valor_consulta_cartao: 0,
        duracao_consulta_min: 60,
      };
      const { data: prof, error: profErr } = await supabaseAdmin
        .from("profissionais")
        .insert({
          user_id: newUserId,
          nome: data.nome,
          email: data.email,
          telefone: data.telefone ?? null,
          especialidade_id: p.especialidade_id ?? null,
          registro_profissional: p.registro_profissional ?? null,
          descricao: p.descricao ?? null,
          formacao: p.formacao ?? null,
          anos_experiencia: p.anos_experiencia ?? null,
          valor_consulta_avista: p.valor_consulta_avista,
          valor_consulta_cartao: p.valor_consulta_cartao,
          duracao_consulta_min: p.duracao_consulta_min,
          foto_url: p.foto_url ?? null,
          status: "ATIVO",
        })
        .select("id")
        .single();
      if (profErr) throw new Error(profErr.message);
      profissionalId = prof.id;
    }

    const { registrarAuditoriaExterna } = await import("@/lib/users.server");
    await registrarAuditoriaExterna({
      actorId: context.userId,
      targetId: newUserId,
      acao: "USUARIO_CRIADO",
      detalhes: `Conta criada com o perfil ${data.role}.`,
    });

    return { userId: newUserId, profissionalId };
  });

const updateRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["ADMIN", "RECEPCIONISTA", "PROFISSIONAL", "CLIENTE"]),
});

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof updateRoleSchema>) => updateRoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);

    const { registrarAuditoriaExterna } = await import("@/lib/users.server");
    await registrarAuditoriaExterna({
      actorId: context.userId,
      targetId: data.user_id,
      acao: "PAPEL_ALTERADO",
      detalhes: `Perfil alterado para ${data.role}.`,
    });

    return { ok: true };
  });
