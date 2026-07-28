-- 1) Campos extras do profissional
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS formacao text;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS anos_experiencia integer;

-- 2) View pública atualizada
DROP VIEW IF EXISTS public.profissionais_public;
CREATE VIEW public.profissionais_public
WITH (security_invoker = true)
AS
SELECT
  id,
  nome,
  foto_url,
  descricao,
  formacao,
  anos_experiencia,
  registro_profissional,
  duracao_consulta_min,
  valor_consulta_avista,
  valor_consulta_cartao,
  especialidade_id,
  status,
  created_at
FROM public.profissionais
WHERE status = 'ATIVO';

GRANT SELECT ON public.profissionais_public TO anon, authenticated;

-- 3) Configurações da clínica (singleton)
CREATE TABLE IF NOT EXISTS public.configuracoes_clinica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT 'Clínica',
  tagline text,
  logo_url text,
  hero_titulo text,
  hero_subtitulo text,
  hero_imagem_url text,
  og_imagem_url text,
  texto_institucional text,
  endereco text,
  telefone text,
  whatsapp text,
  email text,
  horarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  redes_sociais jsonb NOT NULL DEFAULT '{}'::jsonb,
  latitude numeric(10,6),
  longitude numeric(10,6),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.configuracoes_clinica TO anon;
GRANT SELECT, INSERT, UPDATE ON public.configuracoes_clinica TO authenticated;
GRANT ALL ON public.configuracoes_clinica TO service_role;

ALTER TABLE public.configuracoes_clinica ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cfg_read_public ON public.configuracoes_clinica;
CREATE POLICY cfg_read_public ON public.configuracoes_clinica
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS cfg_admin_insert ON public.configuracoes_clinica;
CREATE POLICY cfg_admin_insert ON public.configuracoes_clinica
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

DROP POLICY IF EXISTS cfg_admin_update ON public.configuracoes_clinica;
CREATE POLICY cfg_admin_update ON public.configuracoes_clinica
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

DROP TRIGGER IF EXISTS trg_cfg_updated_at ON public.configuracoes_clinica;
CREATE TRIGGER trg_cfg_updated_at
  BEFORE UPDATE ON public.configuracoes_clinica
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.configuracoes_clinica (
  nome, tagline, texto_institucional, endereco, telefone, whatsapp, email,
  horarios, redes_sociais, latitude, longitude, hero_titulo, hero_subtitulo
)
SELECT
  'Clínica',
  'Cuidado clínico com estética premium',
  'Na Clínica unimos tecnologia, acolhimento e excelência clínica para oferecer uma experiência de cuidado completa.',
  'Av. Paulista, 1000 — Bela Vista, São Paulo — SP, 01310-100',
  '+55 (11) 4000-0000',
  '+55 (11) 99999-0000',
  'contato@clinicazoe.com.br',
  '[{"dias":"Segunda a Sexta","horario":"08:00 — 20:00"},{"dias":"Sábado","horario":"09:00 — 14:00"},{"dias":"Domingo","horario":"Fechado"}]'::jsonb,
  '{}'::jsonb,
  -23.561300,
  -46.655800,
  'Cuidado clínico com estética premium',
  'Agende sua consulta com profissionais qualificados e acompanhe tudo pela sua área exclusiva.'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes_clinica);