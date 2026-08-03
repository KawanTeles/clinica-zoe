# Skill: patients

## Objetivo

Orientar mudanças no cadastro e visualização de pacientes (`public.pacientes`),
incluindo a diferença entre a visão "recepção/admin" (todos os pacientes) e
a visão "profissional" (apenas pacientes com vínculo de agendamento).

## Quando utilizar

- Ao alterar `src/routes/app.pacientes.tsx` (visão ADMIN/RECEPCIONISTA) ou
  `src/routes/app.meus-pacientes.tsx` (visão PROFISSIONAL).
- Ao adicionar um campo novo ao cadastro de paciente.
- Ao integrar upload de foto de paciente (`AvatarUploader`,
  bucket `clientes`/`pacientes`).
- Ao investigar por que um profissional não vê (ou vê a mais) um paciente.

## Boas práticas

- Use `PersonAvatar`/`ProfilePhoto` (`src/lib/avatar.tsx`) para exibir foto
  de paciente — já resolve fallback de iniciais e Signed URL.
- Valide o formulário de paciente com `zod` antes de enviar (ver `schema`
  em `app.pacientes.tsx`) — nome mínimo 2 caracteres, e-mail opcional mas
  validado se preenchido.
- Ao ligar um paciente a um usuário autenticado (`pacientes.user_id`),
  lembre que isso é o que permite ao próprio paciente ver seus dados na Área
  do Cliente (policy `pac_read`, cláusula `user_id = auth.uid()`) — não deixe
  esse campo `null` se o cadastro foi originado por um paciente logado.
- Para a visão `PROFISSIONAL`, sempre filtre pacientes pela relação com
  `agendamentos`/`profissionais` (o profissional só deveria ver quem já
  teve/tem consulta marcada com ele) — não implemente uma listagem "todos os
  pacientes" para esse papel.
- Telefone/WhatsApp de paciente é normalizado automaticamente pelo banco
  (`trg_pacientes_norm_whatsapp`) — não normalize de novo no client antes de
  salvar (evita formato duplamente processado).

## Más práticas

- Buscar pacientes sem `order("nome")` — a listagem do projeto é sempre
  alfabética.
- Duplicar campos de paciente que já existem em `profiles` quando o paciente
  também é um usuário autenticado — `pacientes` e `profiles` são entidades
  relacionadas mas distintas (um `profiles` é qualquer conta autenticada; um
  `pacientes` é o registro clínico/comercial, podendo até existir sem
  `user_id` para paciente cadastrado presencialmente sem login).
- Expor `pacientes.observacoes` livremente para qualquer papel — hoje é
  visível a quem tem `SELECT` na tabela (ADMIN, RECEPCIONISTA, o próprio
  paciente, e PROFISSIONAL vinculado); trate como dado sensível ao desenhar
  telas novas que agreguem esse texto em relatórios/exportações.

## Fluxo recomendado

1. Defina se o cadastro é feito pela recepção (`app.pacientes.tsx`, staff)
   ou pelo próprio paciente (fluxo de agendamento no site público, que cria
   `pacientes` vinculado ao `user_id` da sessão `client`).
2. Aplique o schema `zod` do formulário.
3. `insert`/`update` em `pacientes` via client Supabase — RLS decide quem
   pode.
4. Invalide `["pacientes"]` (e `["pacientes-lite"]` se a tela de agenda
   também estiver montada) após criar/editar.
5. Se envolver foto, use `AvatarUploader` apontando para o bucket correto e
   salve o valor retornado (`"bucket/caminho"`) em `foto_url` — nunca salve
   uma URL pública direta.

## Checklist

- [ ] Formulário validado com `zod` antes do `insert`/`update`?
- [ ] Foto usa `AvatarUploader` + `PersonAvatar`, não um `<img src>` cru?
- [ ] Visão de `PROFISSIONAL` filtra por vínculo de agendamento, não lista
      todos os pacientes?
- [ ] `queryKey` de listagem invalidada após criar/editar?
- [ ] Testado o caso de paciente sem `user_id` (cadastro presencial) e com
      `user_id` (auto-cadastro pelo site)?

## Regras obrigatórias

- `pacientes.user_id` é opcional (paciente pode existir sem conta de
  login), mas quando presente é o vínculo que dá acesso via Área do
  Cliente — nunca setado manualmente para o `id` de outro usuário.
- Exclusão de paciente não é exposta como operação de UI padrão — o padrão
  do projeto para "remover" dado de usuário é soft delete a nível de conta
  (ver [[permissions]]), não deleção física de `pacientes` (que quebraria
  `agendamentos`/`financeiro` históricos referenciando `paciente_id`).

## Arquivos normalmente envolvidos

- `src/routes/app.pacientes.tsx`, `app.meus-pacientes.tsx`
- `src/components/media/AvatarUploader.tsx`, `src/lib/avatar.tsx`
- Tabela `public.pacientes`, policies `pac_read`, `pac_staff_insert`,
  `pac_staff_update`, `pac_admin_delete`.

## Erros comuns

- Confundir `pacientes.telefone` (livre) com `pacientes.whatsapp`
  (normalizado e usado para deep link `wa.me`) — use o campo certo conforme
  a finalidade (exibição vs ação de contato).
- Esquecer `enabled: open` em queries de paciente dentro de diálogos (ver
  `pacientes-lite` em `AgendaView.tsx`) — evita buscar a lista inteira de
  pacientes antes do diálogo ser aberto.

## Exemplos

Ver `examples.md`.

## Observações

Não existe hoje um módulo de prontuário clínico estruturado — o único campo
de anotação é `pacientes.observacoes` (texto livre). Ver [[medical-records]]
para o estado atual e diretrizes caso essa funcionalidade seja expandida.
