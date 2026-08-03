-- Colunas de ajuste no lançamento
ALTER TABLE public.financeiro
  ADD COLUMN IF NOT EXISTS desconto numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS juros numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS multa numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vencimento date,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- Pagamentos (baixas)
CREATE TABLE IF NOT EXISTS public.financeiro_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financeiro_id uuid NOT NULL REFERENCES public.financeiro(id) ON DELETE CASCADE,
  valor_pago numeric(10,2) NOT NULL CHECK (valor_pago > 0),
  forma_pagamento public.forma_pagamento,
  pago_em timestamptz NOT NULL DEFAULT now(),
  observacoes text,
  registrado_por uuid,
  estornado boolean NOT NULL DEFAULT false,
  estornado_em timestamptz,
  estornado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_pagamentos TO authenticated;
GRANT ALL ON public.financeiro_pagamentos TO service_role;
ALTER TABLE public.financeiro_pagamentos ENABLE ROW LEVEL SECURITY;

-- Parcelas
CREATE TABLE IF NOT EXISTS public.financeiro_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financeiro_id uuid NOT NULL REFERENCES public.financeiro(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  valor numeric(10,2) NOT NULL,
  vencimento date NOT NULL,
  status_pagamento public.financeiro_status NOT NULL DEFAULT 'ABERTO',
  pago_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (financeiro_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_parcelas TO authenticated;
GRANT ALL ON public.financeiro_parcelas TO service_role;
ALTER TABLE public.financeiro_parcelas ENABLE ROW LEVEL SECURITY;

-- Anexos (comprovantes)
CREATE TABLE IF NOT EXISTS public.financeiro_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financeiro_id uuid NOT NULL REFERENCES public.financeiro(id) ON DELETE CASCADE,
  arquivo_path text NOT NULL,
  nome_arquivo text NOT NULL,
  enviado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.financeiro_anexos TO authenticated;
GRANT ALL ON public.financeiro_anexos TO service_role;
ALTER TABLE public.financeiro_anexos ENABLE ROW LEVEL SECURITY;

-- Auditoria
CREATE TABLE IF NOT EXISTS public.financeiro_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financeiro_id uuid NOT NULL REFERENCES public.financeiro(id) ON DELETE CASCADE,
  acao text NOT NULL,
  actor_id uuid,
  actor_nome text,
  valor_anterior numeric(10,2),
  valor_novo numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.financeiro_auditoria TO authenticated;
GRANT ALL ON public.financeiro_auditoria TO service_role;
ALTER TABLE public.financeiro_auditoria ENABLE ROW LEVEL SECURITY;

-- Policies: equipe (ADMIN/RECEPCIONISTA) gerencia; profissional vê o que é seu
DROP POLICY IF EXISTS fin_pag_select ON public.financeiro_pagamentos;
CREATE POLICY fin_pag_select ON public.financeiro_pagamentos FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'ADMIN'::app_role) OR has_role(auth.uid(),'RECEPCIONISTA'::app_role)
  OR EXISTS (SELECT 1 FROM public.financeiro f JOIN public.profissionais p ON p.id = f.profissional_id
             WHERE f.id = financeiro_id AND p.user_id = auth.uid())
);
DROP POLICY IF EXISTS fin_pag_write ON public.financeiro_pagamentos;
CREATE POLICY fin_pag_write ON public.financeiro_pagamentos FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'ADMIN'::app_role) OR has_role(auth.uid(),'RECEPCIONISTA'::app_role));
DROP POLICY IF EXISTS fin_pag_update ON public.financeiro_pagamentos;
CREATE POLICY fin_pag_update ON public.financeiro_pagamentos FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'ADMIN'::app_role) OR has_role(auth.uid(),'RECEPCIONISTA'::app_role))
WITH CHECK (has_role(auth.uid(),'ADMIN'::app_role) OR has_role(auth.uid(),'RECEPCIONISTA'::app_role));

DROP POLICY IF EXISTS fin_parc_select ON public.financeiro_parcelas;
CREATE POLICY fin_parc_select ON public.financeiro_parcelas FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'ADMIN'::app_role) OR has_role(auth.uid(),'RECEPCIONISTA'::app_role)
  OR EXISTS (SELECT 1 FROM public.financeiro f JOIN public.profissionais p ON p.id = f.profissional_id
             WHERE f.id = financeiro_id AND p.user_id = auth.uid())
);
DROP POLICY IF EXISTS fin_parc_write ON public.financeiro_parcelas;
CREATE POLICY fin_parc_write ON public.financeiro_parcelas FOR ALL TO authenticated
USING (has_role(auth.uid(),'ADMIN'::app_role) OR has_role(auth.uid(),'RECEPCIONISTA'::app_role))
WITH CHECK (has_role(auth.uid(),'ADMIN'::app_role) OR has_role(auth.uid(),'RECEPCIONISTA'::app_role));

DROP POLICY IF EXISTS fin_anexo_select ON public.financeiro_anexos;
CREATE POLICY fin_anexo_select ON public.financeiro_anexos FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'ADMIN'::app_role) OR has_role(auth.uid(),'RECEPCIONISTA'::app_role)
  OR EXISTS (SELECT 1 FROM public.financeiro f JOIN public.profissionais p ON p.id = f.profissional_id
             WHERE f.id = financeiro_id AND p.user_id = auth.uid())
);
DROP POLICY IF EXISTS fin_anexo_write ON public.financeiro_anexos;
CREATE POLICY fin_anexo_write ON public.financeiro_anexos FOR ALL TO authenticated
USING (has_role(auth.uid(),'ADMIN'::app_role) OR has_role(auth.uid(),'RECEPCIONISTA'::app_role))
WITH CHECK (has_role(auth.uid(),'ADMIN'::app_role) OR has_role(auth.uid(),'RECEPCIONISTA'::app_role));

DROP POLICY IF EXISTS fin_audit_select ON public.financeiro_auditoria;
CREATE POLICY fin_audit_select ON public.financeiro_auditoria FOR SELECT TO authenticated
USING (has_role(auth.uid(),'ADMIN'::app_role));

-- Recalcula status do lançamento a partir das baixas
CREATE OR REPLACE FUNCTION public.recalcular_status_financeiro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fin uuid := COALESCE(NEW.financeiro_id, OLD.financeiro_id);
  v_pago numeric(10,2);
  v_devido numeric(10,2);
  v_ultimo timestamptz;
BEGIN
  SELECT COALESCE(SUM(valor_pago),0), MAX(pago_em)
    INTO v_pago, v_ultimo
    FROM public.financeiro_pagamentos
   WHERE financeiro_id = v_fin AND estornado = false;

  SELECT COALESCE(valor,0) - COALESCE(desconto,0) + COALESCE(juros,0) + COALESCE(multa,0)
    INTO v_devido FROM public.financeiro WHERE id = v_fin;

  UPDATE public.financeiro
     SET status_pagamento = CASE
           WHEN status_pagamento = 'CANCELADO' THEN 'CANCELADO'
           WHEN v_pago <= 0 THEN 'ABERTO'
           WHEN v_pago >= v_devido THEN 'PAGO'
           ELSE 'PARCIAL' END,
         pago_em = CASE WHEN v_pago >= v_devido AND v_devido > 0 THEN v_ultimo ELSE NULL END
   WHERE id = v_fin;

  INSERT INTO public.financeiro_auditoria (financeiro_id, acao, actor_id, actor_nome, valor_anterior, valor_novo)
  SELECT v_fin,
         CASE WHEN TG_OP = 'INSERT' THEN 'BAIXA_REGISTRADA'
              WHEN TG_OP = 'UPDATE' AND NEW.estornado AND NOT OLD.estornado THEN 'BAIXA_ESTORNADA'
              ELSE 'BAIXA_ATUALIZADA' END,
         auth.uid(), (SELECT nome FROM public.profiles WHERE id = auth.uid()),
         CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.valor_pago END,
         COALESCE(NEW.valor_pago, OLD.valor_pago);

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_fin_pag_recalc ON public.financeiro_pagamentos;
CREATE TRIGGER trg_fin_pag_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_pagamentos
FOR EACH ROW EXECUTE FUNCTION public.recalcular_status_financeiro();

-- Evolução mensal agregada
CREATE OR REPLACE FUNCTION public.financeiro_evolucao_mensal(p_meses integer DEFAULT 12)
RETURNS TABLE(mes text, recebido numeric, aberto numeric, qtd bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH meses AS (
    SELECT to_char(d, 'YYYY-MM') AS m
      FROM generate_series(date_trunc('month', now()) - ((GREATEST(p_meses,1) - 1) || ' months')::interval,
                           date_trunc('month', now()), interval '1 month') d
  )
  SELECT m AS mes,
         COALESCE(SUM(CASE WHEN f.status_pagamento = 'PAGO'
                           THEN COALESCE(f.valor,0) - COALESCE(f.desconto,0) + COALESCE(f.juros,0) + COALESCE(f.multa,0) END), 0) AS recebido,
         COALESCE(SUM(CASE WHEN f.status_pagamento IN ('ABERTO','PARCIAL')
                           THEN COALESCE(f.valor,0) - COALESCE(f.desconto,0) + COALESCE(f.juros,0) + COALESCE(f.multa,0) END), 0) AS aberto,
         COUNT(f.id) AS qtd
    FROM meses
    LEFT JOIN public.financeiro f
      ON to_char(COALESCE(f.pago_em, f.created_at), 'YYYY-MM') = meses.m
   GROUP BY m
   ORDER BY m;
$$;
REVOKE ALL ON FUNCTION public.financeiro_evolucao_mensal(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.financeiro_evolucao_mensal(integer) TO authenticated;