
-- Public read access for the institutional site (anon role)
GRANT SELECT ON public.especialidades TO anon;
GRANT SELECT ON public.profissionais TO anon;
GRANT SELECT ON public.profissional_disponibilidade TO anon;
GRANT SELECT ON public.profissional_bloqueio TO anon;

CREATE POLICY "esp_read_public" ON public.especialidades
  FOR SELECT TO anon USING (true);

CREATE POLICY "prof_read_public" ON public.profissionais
  FOR SELECT TO anon USING (status = 'ATIVO');

CREATE POLICY "disp_read_public" ON public.profissional_disponibilidade
  FOR SELECT TO anon USING (true);

CREATE POLICY "bloq_read_public" ON public.profissional_bloqueio
  FOR SELECT TO anon USING (true);

-- Secure availability lookup: returns free slot start times for a given
-- professional on a given date, respecting disponibilidade, bloqueios and
-- existing agendamentos. Does NOT expose the appointment rows themselves.
CREATE OR REPLACE FUNCTION public.horarios_disponiveis(
  p_profissional_id uuid,
  p_data date
)
RETURNS TABLE (hora_inicio time, hora_fim time)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duracao int;
  v_dia_semana int;
  r record;
  slot_start time;
  slot_end time;
BEGIN
  SELECT COALESCE(duracao_consulta_min, 30) INTO v_duracao
    FROM public.profissionais WHERE id = p_profissional_id AND status = 'ATIVO';
  IF v_duracao IS NULL THEN RETURN; END IF;

  v_dia_semana := EXTRACT(DOW FROM p_data)::int;

  FOR r IN
    SELECT d.hora_inicio AS d_ini, d.hora_fim AS d_fim
    FROM public.profissional_disponibilidade d
    WHERE d.profissional_id = p_profissional_id
      AND d.dia_semana = v_dia_semana
    ORDER BY d.hora_inicio
  LOOP
    slot_start := r.d_ini;
    LOOP
      slot_end := slot_start + (v_duracao || ' minutes')::interval;
      EXIT WHEN slot_end > r.d_fim;

      -- Skip if in the past for today
      IF p_data > CURRENT_DATE
         OR (p_data = CURRENT_DATE AND slot_start > CURRENT_TIME)
      THEN
        -- Not overlapped by bloqueio
        IF NOT EXISTS (
          SELECT 1 FROM public.profissional_bloqueio b
          WHERE b.profissional_id = p_profissional_id
            AND b.data = p_data
            AND b.hora_inicio < slot_end
            AND b.hora_fim > slot_start
        )
        -- Not overlapped by existing non-cancelled agendamento
        AND NOT EXISTS (
          SELECT 1 FROM public.agendamentos a
          WHERE a.profissional_id = p_profissional_id
            AND a.data = p_data
            AND a.status NOT IN ('CANCELADO','RECUSADO')
            AND a.hora_inicio < slot_end
            AND a.hora_fim > slot_start
        )
        THEN
          hora_inicio := slot_start;
          hora_fim := slot_end;
          RETURN NEXT;
        END IF;
      END IF;

      slot_start := slot_end;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.horarios_disponiveis(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.horarios_disponiveis(uuid, date) TO anon, authenticated;
