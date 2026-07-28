-- 1) Config table (server-only access)
CREATE TABLE IF NOT EXISTS public.notificacoes_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_solicitacao text NOT NULL DEFAULT 'PROFISSIONAL',
  lembrete_24h_ativo boolean NOT NULL DEFAULT true,
  lembrete_2h_ativo boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'console',
  provider_url text,
  provider_token text,
  remetente text,
  conexao_status text NOT NULL DEFAULT 'NAO_TESTADA',
  conexao_testada_em timestamptz,
  conexao_erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notificacoes_config_destinatario_chk
    CHECK (destinatario_solicitacao IN ('PROFISSIONAL','RECEPCIONISTA','AMBOS'))
);

GRANT ALL ON public.notificacoes_config TO service_role;
ALTER TABLE public.notificacoes_config ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: reachable only through server code (service role).

CREATE TRIGGER trg_notif_config_updated
BEFORE UPDATE ON public.notificacoes_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.notificacoes_config (destinatario_solicitacao)
SELECT 'PROFISSIONAL'
WHERE NOT EXISTS (SELECT 1 FROM public.notificacoes_config);

-- 2) WhatsApp fields
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS whatsapp text;

-- 3) New reminder event
ALTER TYPE public.notif_evento ADD VALUE IF NOT EXISTS 'LEMBRETE_2H';
