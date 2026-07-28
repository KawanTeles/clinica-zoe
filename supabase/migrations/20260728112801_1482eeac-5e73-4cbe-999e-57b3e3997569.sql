ALTER TABLE public.notificacoes_config
  ADD COLUMN IF NOT EXISTS janela_inicio time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS janela_fim time NOT NULL DEFAULT '20:00',
  ADD COLUMN IF NOT EXISTS janela_ativa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS templates jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS duracao_ms integer;

DROP POLICY IF EXISTS notif_read ON public.notificacoes;
CREATE POLICY notif_read ON public.notificacoes
FOR SELECT TO authenticated
USING (
  usuario_id = auth.uid()
  OR public.has_role(auth.uid(), 'ADMIN'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.agendamentos a
    WHERE a.id = notificacoes.agendamento_id
      AND (
        a.cliente_user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = a.paciente_id AND p.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profissionais pr WHERE pr.id = a.profissional_id AND pr.user_id = auth.uid())
      )
  )
);