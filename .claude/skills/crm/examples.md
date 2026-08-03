# Exemplos — crm

## 1. Central de Solicitações filtrando por papel

`src/routes/app.solicitacoes.tsx`:

```ts
const isProfissional = hasRole("PROFISSIONAL") && !hasRole("ADMIN") && !hasRole("RECEPCIONISTA");

const { data: profId } = useQuery({
  queryKey: ["meu-profissional-id", user?.id],
  queryFn: async () => {
    const { data } = await supabase.from("profissionais").select("id").eq("user_id", user!.id).maybeSingle();
    return data?.id ?? null;
  },
  enabled: !!user && isProfissional,
});
// a query de solicitações usa profId para filtrar quando isProfissional é true
```

## 2. Confirmação com atalho de WhatsApp

`src/routes/app.index.tsx` (aprovação rápida no Dashboard):

```ts
if (item.paciente?.telefone) {
  const msg = formatPatientConfirmationMsg({
    pacienteNome: item.paciente?.nome ?? "Paciente",
    pacienteTelefone: item.paciente?.telefone ?? "",
    profissionalNome: item.profissional?.nome ?? "Profissional",
    especialidadeNome: item.profissional?.especialidade?.nome ?? "Consulta",
    data: item.data,
    horario: `${String(item.hora_inicio).slice(0, 5)} - ${String(item.hora_fim).slice(0, 5)}`,
  });
  openWhatsAppLink(getWhatsAppUrl(item.paciente.telefone, msg));
}
```

## 3. Notificação da clínica gerada pelo próprio paciente (site público)

`src/lib/whatsapp-link.ts` monta a mensagem que o paciente envia à clínica
ao concluir o wizard de agendamento:

```ts
export function formatClinicNotificationMsg(info: SolicitacaoWhatsAppInfo): string {
  return `*NOVA SOLICITAÇÃO DE AGENDAMENTO*

*Paciente:*
${info.pacienteNome}
...
*Data:*
${formatDateBR(info.data)}`;
}

export function getClinicWhatsAppNotificationUrl(info: SolicitacaoWhatsAppInfo): string {
  return getWhatsAppUrl(CLINIC_WHATSAPP_NUMBER, formatClinicNotificationMsg(info));
}
```
