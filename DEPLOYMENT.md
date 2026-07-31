# Checklist de Implantação — Clínica Zoe

Objetivo: clonar o repositório em qualquer ambiente e colocar no ar apenas
configurando o `.env`.

## 1. Código

- [ ] `git clone` do repositório
- [ ] `cp .env.example .env`
- [ ] `npm install`
- [ ] `npm run build` sem erros
- [ ] `npm run dev` abre em `http://localhost:8080`

## 2. Variáveis de ambiente

- [ ] `VITE_SUPABASE_URL` = `https://<ref>.supabase.co`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` = chave publishable/anon
- [ ] `VITE_SUPABASE_PROJECT_ID` = `<ref>`
- [ ] `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` iguais aos acima
- [ ] `SUPABASE_SERVICE_ROLE_KEY` definida **apenas** no servidor (nunca com prefixo `VITE_`)
- [ ] `VITE_SITE_URL` = URL pública final, sem barra no fim
- [ ] `VITE_OG_IMAGE` (opcional) = imagem absoluta https de preview social

## 3. Banco de dados

- [ ] `01_extensions.sql` aplicado (pgcrypto, pg_cron, pg_net)
- [ ] `02_schema_public.sql` aplicado (20 tabelas, funções, triggers, RLS)
- [ ] `03_storage.sql` aplicado (buckets + policies)
- [ ] RLS habilitado em todas as tabelas do schema `public`
- [ ] `GRANT`s presentes para `authenticated` / `service_role`
- [ ] Trigger `on_auth_user_created` criada em `auth.users`
- [ ] Funções validadas: `has_role`, `horarios_disponiveis`, `resolve_valor_consulta`,
      `enqueue_notificacao`, `gerar_lembretes`, `notif_config`, `normalizar_whatsapp`
- [ ] Triggers validadas: conflito de agenda, valor congelado, financeiro na aprovação,
      notificações de agendamento/financeiro, disponibilidade padrão, updated_at
- [ ] `cron.schedule('gerar-lembretes', '*/15 * * * *', ...)` ativa

## 4. Autenticação

- [ ] Provider Email habilitado (sem auto-confirm, salvo decisão contrária)
- [ ] Provider Google habilitado (se utilizado)
- [ ] Site URL e Redirect URLs configuradas (`https://dominio/**` e `http://localhost:8080/**`)
- [ ] Template de recuperação de senha revisado
- [ ] Primeiro usuário promovido a `ADMIN` em `public.user_roles`
- [ ] Login da equipe (`/auth`) e do cliente (`/cliente/login`) funcionando com sessões independentes

## 5. Storage

- [ ] Buckets `profissionais`, `clientes`, `clinica` existentes e **privados**
- [ ] Policies de leitura/escrita aplicadas
- [ ] Arquivos migrados com os mesmos paths
- [ ] Upload de avatar funcionando no painel
- [ ] Signed URLs retornando HTTP 200

## 6. Aplicação

- [ ] Dashboard, Agenda, Solicitações, Pacientes, Profissionais, Especialidades
- [ ] Financeiro com valores corretos (dashboard e lista)
- [ ] Central de Notificações e timeline
- [ ] Configurações da clínica refletindo no site público
- [ ] Site público: home, especialidades, profissionais, contato
- [ ] Wizard de agendamento exibindo horários disponíveis
- [ ] Área do cliente exibindo apenas dados do próprio usuário

## 7. WhatsApp (opcional)

- [ ] `whatsapp_meta_config` preenchida (phone_number_id, token, waba_id)
- [ ] Templates sincronizados
- [ ] Endpoint `/api/public/test-whatsapp` respondendo `ok: true`
- [ ] Webhook da Meta apontando para o domínio publicado

## 8. Publicação

- [ ] Preset do Nitro correto (`NITRO_PRESET=vercel` / `netlify` / padrão Cloudflare)
- [ ] Variáveis de ambiente cadastradas no provedor (service role como *secret*)
- [ ] Domínio customizado apontado
- [ ] `VITE_SITE_URL` atualizada e novo build publicado
- [ ] `/sitemap.xml` e `/robots.txt` retornando o domínio correto
