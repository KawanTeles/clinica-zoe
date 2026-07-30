-- Migration: Remove 100% of WhatsApp and Meta tables, functions, triggers, and columns

DROP TABLE IF EXISTS public.whatsapp_message_logs CASCADE;
DROP TABLE IF EXISTS public.whatsapp_evento_templates CASCADE;
DROP TABLE IF EXISTS public.whatsapp_templates CASCADE;
DROP TABLE IF EXISTS public.whatsapp_sessions CASCADE;
DROP TABLE IF EXISTS public.whatsapp_queue CASCADE;
DROP TABLE IF EXISTS public.whatsapp_meta_config CASCADE;

DROP FUNCTION IF EXISTS public.normalizar_whatsapp(text) CASCADE;
DROP FUNCTION IF EXISTS public.normalizar_telefone_wa(text) CASCADE;

DROP TYPE IF EXISTS public.wa_status CASCADE;

ALTER TABLE IF EXISTS public.pacientes DROP COLUMN IF EXISTS whatsapp;
ALTER TABLE IF EXISTS public.profissionais DROP COLUMN IF EXISTS whatsapp;
ALTER TABLE IF EXISTS public.solicitacoes_agendamento DROP COLUMN IF EXISTS whatsapp;
ALTER TABLE IF EXISTS public.configuracoes_clinica DROP COLUMN IF EXISTS whatsapp;
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS whatsapp;
