// Ponto de entrada único do app: cliente Supabase isolado por área
// (Área do Paciente x Painel Administrativo).
export {
  supabase,
  getSupabaseFor,
  scopeForPath,
  currentScope,
  type AuthScope,
} from "@/integrations/supabase/dual-client";
