
REVOKE ALL ON FUNCTION public.on_agendamento_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_financeiro_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_notificacao(uuid,text,text,notif_evento,notif_canal,uuid,text,text) FROM PUBLIC, anon, authenticated;
