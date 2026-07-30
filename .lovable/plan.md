Vou construir o painel administrativo da Clínica em etapas, validando cada uma antes de avançar. Nesta primeira entrega o foco é a **fundação**: banco de dados, autenticação, permissões e layout administrativo com as 3 áreas (Admin, Recepcionista, Profissional). Os módulos de negócio (agenda, financeiro, notificações) vêm nas etapas seguintes, sobre essa base já testada.

## Escopo desta entrega (Etapa 1 + 2)

**1. Lovable Cloud + Autenticação**
- Ativar Lovable Cloud (banco nativo, sem Supabase externo).
- Login por email + senha, com tela `/auth` (login e cadastro).
- Cadastro público só cria usuário com role `CLIENTE`. Profissionais e recepcionistas são criados pelo Admin.
- Rota `/` = landing simples com CTA "Entrar no painel". Painel fica em `/app/*` protegido.

**2. Banco de dados (migração única)**
Tabelas conforme especificação, com enums e RLS desde o início:
- `profiles` (1‑1 com auth.users): nome, telefone, email
- `user_roles` (tabela separada, obrigatório por segurança) com enum `app_role` = ADMIN | RECEPCIONISTA | PROFISSIONAL | CLIENTE
- `especialidades`
- `profissionais` (FK user_id, especialidade_id, valores, duração, status)
- `pacientes` (FK user_id opcional — permite paciente sem login)
- `agendamentos` (enum status: PENDENTE, APROVADO, RECUSADO, CANCELADO, REMARCADO, FINALIZADO)
- `financeiro` (enum status: ABERTO, PAGO, CANCELADO)
- `notificacoes`
- Função `has_role(user_id, role)` SECURITY DEFINER
- Trigger que cria `profiles` + role `CLIENTE` automaticamente no signup

**3. Segurança (RLS em todas as tabelas)**
- ADMIN: acesso total via `has_role(auth.uid(), 'ADMIN')`
- RECEPCIONISTA: SELECT em agendamentos/pacientes/profissionais; sem acesso a financeiro nem user_roles
- PROFISSIONAL: SELECT/UPDATE apenas nos próprios dados (agendamentos onde `profissional_id` = seu próprio, seus pacientes vinculados)
- CLIENTE: SELECT/UPDATE apenas nos próprios dados
- Toda validação no banco — o frontend apenas esconde UI

**4. Layout do painel**
- Sidebar shadcn colapsável com menus diferentes por role (Admin / Recepcionista / Profissional)
- Header com nome do usuário e sign‑out
- Rota protegida `_authenticated` com redirect para `/auth` se não logado
- Guard por role em cada seção
- Design system: paleta verde‑petróleo da clínica (#2F8F83 primário, #1F5F59 escuro, #3BAA9B claro, #D6B36A dourado accent), tokens em `src/styles.css`, tipografia limpa, cards com sombras suaves, radius amplo — estética "Apple premium clínica"

**5. Páginas nesta entrega (esqueleto navegável)**
- `/app` dashboard por role (cards com contagens: agendamentos hoje, pendentes, etc.)
- `/app/profissionais` — Admin: listar/criar/editar profissional + criar acesso (email/senha, role PROFISSIONAL)
- `/app/pacientes` — listagem
- `/app/agenda` — placeholder (estrutura de rota + layout base; calendário completo vem na Etapa 4)
- `/app/financeiro` — placeholder (Etapa 6)
- `/app/usuarios` — Admin gerencia roles
- `/app/configuracoes` — especialidades e ajustes gerais

**6. Responsividade**
- Sidebar vira offcanvas no mobile, tabelas viram cards em <768px
- Testado nos breakpoints listados (desktop/tablet/mobile)

## Próximas etapas (não nesta entrega)

- **Etapa 3**: CRUD completo de profissionais/pacientes (formulários finais, upload de foto)
- **Etapa 4**: Agenda/calendário com bloqueio de conflitos, visão por profissional
- **Etapa 5**: Fluxo de solicitação de consulta (cliente → PENDENTE → profissional aceita/recusa → APROVADO gera lançamento financeiro ABERTO)
- **Etapa 6**: Painel financeiro (abertos, pagos, transições de status)
- **Etapa 7**: Notificações
- **Etapa 8**: Testes de ponta a ponta + polimento
- **Etapa 8**: Testes de ponta a ponta + polimento

## Detalhes técnicos

- Stack: TanStack Start + Lovable Cloud (Supabase gerenciado, transparente para o usuário)
- Roles em tabela separada + função `has_role` SECURITY DEFINER (evita recursão em RLS e privilege escalation)
- Toda criação de usuário por Admin usa server function autenticada + `supabaseAdmin` (service role) dentro do handler, após verificar `has_role('ADMIN')`
- Validação com Zod em todos os formulários e server functions
- Cliente Lovable Cloud gerenciado — nenhum Supabase externo é usado

## Pergunta para começar

Confirma que posso ativar o Lovable Cloud agora e seguir com esta Etapa 1? Ao final dela você terá login funcionando, os 3 painéis com menus corretos por role, o banco completo com RLS, e o CRUD de profissionais operacional — pronto para validarmos antes de avançar para a agenda.
