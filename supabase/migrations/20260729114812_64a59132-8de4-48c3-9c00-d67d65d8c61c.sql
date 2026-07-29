ALTER TYPE public.notif_status_envio ADD VALUE IF NOT EXISTS 'ENTREGUE';
ALTER TYPE public.notif_status_envio ADD VALUE IF NOT EXISTS 'LIDO';
ALTER TYPE public.notif_status_envio ADD VALUE IF NOT EXISTS 'RESPONDIDO';
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS mensagem_recebida text;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS respondido_em timestamptz;
ALTER TABLE public.notificacoes_config DROP CONSTRAINT IF EXISTS notificacoes_config_destinatario_chk;
ALTER TABLE public.notificacoes_config ADD CONSTRAINT notificacoes_config_destinatario_chk CHECK (destinatario_solicitacao = ANY (ARRAY['PROFISSIONAL','RECEPCIONISTA','AMBOS','ADMINISTRADOR','TODOS']));