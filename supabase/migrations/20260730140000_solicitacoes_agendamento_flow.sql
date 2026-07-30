-- Migration: Add audit and origin fields for appointment request workflow

ALTER TABLE IF EXISTS public.agendamentos
  ADD COLUMN IF NOT EXISTS origem text DEFAULT 'Site',
  ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text;

-- Performance indexes for appointment workflow
CREATE INDEX IF NOT EXISTS idx_agendamentos_status_data ON public.agendamentos(status, data);
CREATE INDEX IF NOT EXISTS idx_agendamentos_prof_data ON public.agendamentos(profissional_id, data);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
