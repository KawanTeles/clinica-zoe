CREATE OR REPLACE FUNCTION public.seed_disponibilidade_padrao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profissional_disponibilidade d WHERE d.profissional_id = NEW.id) THEN
    INSERT INTO public.profissional_disponibilidade (profissional_id, dia_semana, hora_inicio, hora_fim)
    SELECT NEW.id, dia, faixa.ini, faixa.fim
      FROM generate_series(1,5) AS dia,
           (VALUES ('08:00'::time,'12:00'::time), ('14:00'::time,'18:00'::time)) AS faixa(ini, fim);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_disponibilidade_padrao ON public.profissionais;
CREATE TRIGGER trg_seed_disponibilidade_padrao
AFTER INSERT ON public.profissionais
FOR EACH ROW EXECUTE FUNCTION public.seed_disponibilidade_padrao();