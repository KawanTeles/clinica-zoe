-- Financeiro — Fase 1 (Fundação): Contas a Receber completo.
--
-- Escopo (ver .claude/skills/financial-architect/ e o plano da Fase 1):
--   - desconto/juros/multa/observações/vencimento em `financeiro`
--   - parcelamento (financeiro_parcelas)
--   - baixas / pagamento parcial / múltiplas formas de pagamento
--     (financeiro_pagamentos), com recálculo atômico de status
--   - bloqueio de edição de valor em lançamento já PAGO
--   - anexos de comprovante (financeiro_anexos)
--   - auditoria de alteração (financeiro_auditoria)
--
-- Não altera nenhuma coluna, trigger ou policy existente de `financeiro`,
-- `agendamentos` ou qualquer outra tabela. Depende da migração anterior
-- (20260803160000_financeiro_enum_parcial.sql) já ter sido aplicada.

-- =====================================================================
-- 1. Colunas novas em `financeiro`
-- =====================================================================

ALTER TABLE public.financeiro
  ADD COLUMN IF NOT EXISTS desconto numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS juros numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS multa numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS vencimento date;

COMMENT ON COLUMN public.financeiro.desconto IS 'Abatimento aplicado ao valor congelado do agendamento.';
COMMENT ON COLUMN public.financeiro.juros IS 'Acréscimo por atraso, se aplicável.';
COMMENT ON COLUMN public.financeiro.multa IS 'Multa por atraso, se aplicável.';
COMMENT ON COLUMN public.financeiro.vencimento IS 'Usado apenas quando o lançamento NÃO está parcelado (sem linhas em financeiro_parcelas).';

-- =====================================================================
-- 2. financeiro_parcelas — parcelamento
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.financeiro_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financeiro_id uuid NOT NULL REFERENCES public.financeiro(id) ON DELETE CASCADE,
  numero smallint NOT NULL CHECK (numero > 0),
  valor numeric(10,2) NOT NULL CHECK (valor > 0),
  vencimento date NOT NULL,
  status_pagamento public.financeiro_status NOT NULL DEFAULT 'ABERTO',
  pago_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (financeiro_id, numero)
);

CREATE INDEX IF NOT EXISTS financeiro_parcelas_financeiro_id_idx ON public.financeiro_parcelas (financeiro_id);
CREATE INDEX IF NOT EXISTS financeiro_parcelas_vencimento_idx ON public.financeiro_parcelas (vencimento);

CREATE TRIGGER trg_financeiro_parcelas_updated
  BEFORE UPDATE ON public.financeiro_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.financeiro_parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY parcelas_read ON public.financeiro_parcelas
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.financeiro f
      JOIN public.profissionais p ON p.id = f.profissional_id
      WHERE f.id = financeiro_parcelas.financeiro_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY parcelas_admin_write ON public.financeiro_parcelas
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));

CREATE POLICY parcelas_admin_update ON public.financeiro_parcelas
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));

CREATE POLICY parcelas_admin_delete ON public.financeiro_parcelas
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));

-- =====================================================================
-- 3. financeiro_pagamentos — baixas (pagamento parcial/total, múltiplas
--    formas de pagamento por lançamento)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.financeiro_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financeiro_id uuid NOT NULL REFERENCES public.financeiro(id) ON DELETE CASCADE,
  parcela_id uuid REFERENCES public.financeiro_parcelas(id) ON DELETE SET NULL,
  valor_pago numeric(10,2) NOT NULL CHECK (valor_pago > 0),
  forma_pagamento public.forma_pagamento NOT NULL,
  pago_em timestamptz NOT NULL DEFAULT now(),
  registrado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  observacoes text,
  estornado boolean NOT NULL DEFAULT false,
  estornado_em timestamptz,
  estornado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financeiro_pagamentos_financeiro_id_idx ON public.financeiro_pagamentos (financeiro_id);
CREATE INDEX IF NOT EXISTS financeiro_pagamentos_parcela_id_idx ON public.financeiro_pagamentos (parcela_id);

ALTER TABLE public.financeiro_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY pagamentos_read ON public.financeiro_pagamentos
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.financeiro f
      JOIN public.profissionais p ON p.id = f.profissional_id
      WHERE f.id = financeiro_pagamentos.financeiro_id AND p.user_id = auth.uid()
    )
  );

-- Só ADMIN registra/estorna baixas nesta fase (espelha os botões de ação
-- do Financeiro hoje, restritos a isAdmin na UI).
CREATE POLICY pagamentos_admin_write ON public.financeiro_pagamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ADMIN'::public.app_role)
    AND registrado_por = auth.uid()
  );

CREATE POLICY pagamentos_admin_update ON public.financeiro_pagamentos
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));

-- Nenhuma policy de DELETE: baixa nunca é apagada fisicamente, só estornada
-- (estornado = true via UPDATE), preservando o histórico financeiro.

-- =====================================================================
-- 4. Recálculo atômico do status a partir das baixas
-- =====================================================================

CREATE FUNCTION public.recalcular_status_financeiro(p_financeiro_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_devido numeric(10,2);
  v_pago numeric(10,2);
  v_status_atual public.financeiro_status;
BEGIN
  SELECT (f.valor - f.desconto + f.juros + f.multa), f.status_pagamento
    INTO v_devido, v_status_atual
    FROM public.financeiro f WHERE f.id = p_financeiro_id;

  IF v_status_atual IS NULL THEN
    RETURN; -- lançamento não encontrado (não deveria acontecer via FK)
  END IF;

  SELECT COALESCE(SUM(p.valor_pago), 0) INTO v_pago
    FROM public.financeiro_pagamentos p
    WHERE p.financeiro_id = p_financeiro_id AND p.estornado = false;

  UPDATE public.financeiro
     SET status_pagamento = CASE
           WHEN v_status_atual = 'CANCELADO' THEN 'CANCELADO'::public.financeiro_status
           WHEN v_pago <= 0 THEN 'ABERTO'::public.financeiro_status
           WHEN v_devido > 0 AND v_pago < v_devido THEN 'PARCIAL'::public.financeiro_status
           ELSE 'PAGO'::public.financeiro_status
         END,
         pago_em = CASE
           WHEN v_status_atual != 'CANCELADO' AND v_devido > 0 AND v_pago >= v_devido THEN (
             SELECT MAX(p.pago_em) FROM public.financeiro_pagamentos p
              WHERE p.financeiro_id = p_financeiro_id AND p.estornado = false
           )
           ELSE NULL
         END
   WHERE id = p_financeiro_id;

  -- Atualiza também a parcela específica, quando a baixa está ligada a uma
  IF EXISTS (SELECT 1 FROM public.financeiro_parcelas WHERE financeiro_id = p_financeiro_id) THEN
    UPDATE public.financeiro_parcelas fp
       SET status_pagamento = CASE
             WHEN COALESCE((
               SELECT SUM(p.valor_pago) FROM public.financeiro_pagamentos p
                WHERE p.parcela_id = fp.id AND p.estornado = false
             ), 0) <= 0 THEN 'ABERTO'::public.financeiro_status
             WHEN COALESCE((
               SELECT SUM(p.valor_pago) FROM public.financeiro_pagamentos p
                WHERE p.parcela_id = fp.id AND p.estornado = false
             ), 0) < fp.valor THEN 'PARCIAL'::public.financeiro_status
             ELSE 'PAGO'::public.financeiro_status
           END,
           pago_em = (
             SELECT MAX(p.pago_em) FROM public.financeiro_pagamentos p
              WHERE p.parcela_id = fp.id AND p.estornado = false
           )
     WHERE fp.financeiro_id = p_financeiro_id;
  END IF;
END;
$$;

CREATE FUNCTION public.trg_financeiro_pagamentos_recalc() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.recalcular_status_financeiro(COALESCE(NEW.financeiro_id, OLD.financeiro_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_financeiro_pagamentos_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_financeiro_pagamentos_recalc();

-- =====================================================================
-- 5. Bloqueio de edição direta de valor em lançamento já PAGO
-- =====================================================================

CREATE FUNCTION public.bloquear_edicao_financeiro_pago() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.status_pagamento = 'PAGO' AND (
       NEW.valor IS DISTINCT FROM OLD.valor OR
       NEW.desconto IS DISTINCT FROM OLD.desconto OR
       NEW.juros IS DISTINCT FROM OLD.juros OR
       NEW.multa IS DISTINCT FROM OLD.multa
     ) THEN
    RAISE EXCEPTION 'Lançamento já pago não pode ter valor/desconto/juros/multa alterado diretamente. Registre um estorno da baixa em vez disso.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bloquear_edicao_financeiro_pago
  BEFORE UPDATE ON public.financeiro
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_edicao_financeiro_pago();

-- =====================================================================
-- 6. financeiro_anexos — comprovantes (bucket "financeiro", ver
--    03_storage.sql)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.financeiro_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financeiro_id uuid NOT NULL REFERENCES public.financeiro(id) ON DELETE CASCADE,
  arquivo_path text NOT NULL,
  nome_arquivo text NOT NULL,
  enviado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financeiro_anexos_financeiro_id_idx ON public.financeiro_anexos (financeiro_id);

ALTER TABLE public.financeiro_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY anexos_read ON public.financeiro_anexos
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.financeiro f
      JOIN public.profissionais p ON p.id = f.profissional_id
      WHERE f.id = financeiro_anexos.financeiro_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY anexos_admin_write ON public.financeiro_anexos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role) AND enviado_por = auth.uid());

CREATE POLICY anexos_admin_delete ON public.financeiro_anexos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));

-- =====================================================================
-- 7. financeiro_auditoria — trilha de alteração (só o trigger escreve)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.financeiro_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financeiro_id uuid NOT NULL REFERENCES public.financeiro(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  actor_nome text,
  acao text NOT NULL,
  valor_anterior jsonb,
  valor_novo jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financeiro_auditoria_financeiro_id_idx ON public.financeiro_auditoria (financeiro_id);

ALTER TABLE public.financeiro_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY auditoria_admin_read ON public.financeiro_auditoria
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));

-- Sem policy de INSERT/UPDATE/DELETE para `authenticated`: só as funções
-- SECURITY DEFINER abaixo (rodando como o dono do trigger) escrevem aqui.

CREATE FUNCTION public.log_financeiro_auditoria() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor_nome text;
  v_acao text;
BEGIN
  SELECT nome INTO v_actor_nome FROM public.profiles WHERE id = auth.uid();

  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'financeiro' THEN
    IF NEW.status_pagamento IS DISTINCT FROM OLD.status_pagamento THEN
      v_acao := CASE
        WHEN NEW.status_pagamento = 'CANCELADO' THEN 'CANCELADO'
        WHEN OLD.status_pagamento = 'PAGO' AND NEW.status_pagamento IN ('ABERTO','PARCIAL') THEN 'REABERTO'
        ELSE 'STATUS_ALTERADO'
      END;
      INSERT INTO public.financeiro_auditoria (financeiro_id, actor_id, actor_nome, acao, valor_anterior, valor_novo)
      VALUES (
        NEW.id, auth.uid(), v_actor_nome, v_acao,
        jsonb_build_object('status_pagamento', OLD.status_pagamento, 'valor', OLD.valor, 'desconto', OLD.desconto, 'juros', OLD.juros, 'multa', OLD.multa),
        jsonb_build_object('status_pagamento', NEW.status_pagamento, 'valor', NEW.valor, 'desconto', NEW.desconto, 'juros', NEW.juros, 'multa', NEW.multa)
      );
    ELSIF NEW.desconto IS DISTINCT FROM OLD.desconto OR NEW.juros IS DISTINCT FROM OLD.juros
       OR NEW.multa IS DISTINCT FROM OLD.multa OR NEW.observacoes IS DISTINCT FROM OLD.observacoes THEN
      INSERT INTO public.financeiro_auditoria (financeiro_id, actor_id, actor_nome, acao, valor_anterior, valor_novo)
      VALUES (
        NEW.id, auth.uid(), v_actor_nome, 'EDITADO',
        jsonb_build_object('desconto', OLD.desconto, 'juros', OLD.juros, 'multa', OLD.multa, 'observacoes', OLD.observacoes),
        jsonb_build_object('desconto', NEW.desconto, 'juros', NEW.juros, 'multa', NEW.multa, 'observacoes', NEW.observacoes)
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'financeiro_pagamentos' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.financeiro_auditoria (financeiro_id, actor_id, actor_nome, acao, valor_novo)
      VALUES (NEW.financeiro_id, auth.uid(), v_actor_nome, 'BAIXA_REGISTRADA',
        jsonb_build_object('valor_pago', NEW.valor_pago, 'forma_pagamento', NEW.forma_pagamento, 'pago_em', NEW.pago_em));
      RETURN NEW;
    ELSIF TG_OP = 'UPDATE' AND NEW.estornado = true AND OLD.estornado = false THEN
      INSERT INTO public.financeiro_auditoria (financeiro_id, actor_id, actor_nome, acao, valor_anterior)
      VALUES (NEW.financeiro_id, auth.uid(), v_actor_nome, 'BAIXA_ESTORNADA',
        jsonb_build_object('valor_pago', NEW.valor_pago, 'forma_pagamento', NEW.forma_pagamento));
      RETURN NEW;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_financeiro_auditoria
  AFTER UPDATE ON public.financeiro
  FOR EACH ROW EXECUTE FUNCTION public.log_financeiro_auditoria();

CREATE TRIGGER trg_financeiro_pagamentos_auditoria
  AFTER INSERT OR UPDATE ON public.financeiro_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.log_financeiro_auditoria();

-- =====================================================================
-- 8. Função de agregação para "evolução mensal" (única consulta pesada
--    da Fase 1 — resolvida no banco em vez de trazer 12 meses de linhas).
--    Respeita o mesmo recorte de RLS de `fin_read`: ADMIN vê tudo,
--    PROFISSIONAL só o próprio (via p_profissional_id OU auto-filtro).
-- =====================================================================

CREATE FUNCTION public.financeiro_evolucao_mensal(p_meses integer DEFAULT 12)
RETURNS TABLE(mes date, recebido numeric, aberto numeric, qtd integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin boolean := public.has_role(auth.uid(), 'ADMIN'::public.app_role);
  v_profissional_id uuid;
BEGIN
  IF NOT v_is_admin THEN
    SELECT p.id INTO v_profissional_id FROM public.profissionais p WHERE p.user_id = auth.uid();
    IF v_profissional_id IS NULL THEN
      RETURN; -- nem ADMIN nem PROFISSIONAL com cadastro: sem dados
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    date_trunc('month', COALESCE(f.pago_em, f.created_at))::date AS mes,
    SUM(CASE WHEN f.status_pagamento = 'PAGO' THEN (f.valor - f.desconto + f.juros + f.multa) ELSE 0 END) AS recebido,
    SUM(CASE WHEN f.status_pagamento IN ('ABERTO','PARCIAL') THEN (f.valor - f.desconto + f.juros + f.multa) ELSE 0 END) AS aberto,
    COUNT(*)::integer AS qtd
  FROM public.financeiro f
  WHERE COALESCE(f.pago_em, f.created_at) >= (date_trunc('month', now()) - (p_meses - 1) * interval '1 month')
    AND (v_is_admin OR f.profissional_id = v_profissional_id)
  GROUP BY 1
  ORDER BY 1;
END;
$$;
