export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          cliente_user_id: string | null
          created_at: string
          data: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          hora_fim: string
          hora_inicio: string
          id: string
          observacoes: string | null
          paciente_id: string | null
          profissional_id: string
          status: Database["public"]["Enums"]["agendamento_status"]
          updated_at: string
          valor: number | null
        }
        Insert: {
          cliente_user_id?: string | null
          created_at?: string
          data: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          hora_fim: string
          hora_inicio: string
          id?: string
          observacoes?: string | null
          paciente_id?: string | null
          profissional_id: string
          status?: Database["public"]["Enums"]["agendamento_status"]
          updated_at?: string
          valor?: number | null
        }
        Update: {
          cliente_user_id?: string | null
          created_at?: string
          data?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          hora_fim?: string
          hora_inicio?: string
          id?: string
          observacoes?: string | null
          paciente_id?: string | null
          profissional_id?: string
          status?: Database["public"]["Enums"]["agendamento_status"]
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais_public"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_clinica: {
        Row: {
          created_at: string
          email: string | null
          endereco: string | null
          hero_imagem_url: string | null
          hero_subtitulo: string | null
          hero_titulo: string | null
          horarios: Json
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          nome: string
          og_imagem_url: string | null
          redes_sociais: Json
          tagline: string | null
          telefone: string | null
          texto_institucional: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          endereco?: string | null
          hero_imagem_url?: string | null
          hero_subtitulo?: string | null
          hero_titulo?: string | null
          horarios?: Json
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          nome?: string
          og_imagem_url?: string | null
          redes_sociais?: Json
          tagline?: string | null
          telefone?: string | null
          texto_institucional?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          endereco?: string | null
          hero_imagem_url?: string | null
          hero_subtitulo?: string | null
          hero_titulo?: string | null
          horarios?: Json
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          nome?: string
          og_imagem_url?: string | null
          redes_sociais?: Json
          tagline?: string | null
          telefone?: string | null
          texto_institucional?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      especialidades: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      financeiro: {
        Row: {
          agendamento_id: string | null
          created_at: string
          desconto: number
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          juros: number
          multa: number
          observacoes: string | null
          paciente_id: string | null
          pago_em: string | null
          profissional_id: string | null
          status_pagamento: Database["public"]["Enums"]["financeiro_status"]
          updated_at: string
          valor: number
          vencimento: string | null
        }
        Insert: {
          agendamento_id?: string | null
          created_at?: string
          desconto?: number
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          juros?: number
          multa?: number
          observacoes?: string | null
          paciente_id?: string | null
          pago_em?: string | null
          profissional_id?: string | null
          status_pagamento?: Database["public"]["Enums"]["financeiro_status"]
          updated_at?: string
          valor?: number
          vencimento?: string | null
        }
        Update: {
          agendamento_id?: string | null
          created_at?: string
          desconto?: number
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          juros?: number
          multa?: number
          observacoes?: string | null
          paciente_id?: string | null
          pago_em?: string | null
          profissional_id?: string | null
          status_pagamento?: Database["public"]["Enums"]["financeiro_status"]
          updated_at?: string
          valor?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais_public"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_anexos: {
        Row: {
          arquivo_path: string
          created_at: string
          enviado_por: string
          financeiro_id: string
          id: string
          nome_arquivo: string
        }
        Insert: {
          arquivo_path: string
          created_at?: string
          enviado_por?: string
          financeiro_id: string
          id?: string
          nome_arquivo: string
        }
        Update: {
          arquivo_path?: string
          created_at?: string
          enviado_por?: string
          financeiro_id?: string
          id?: string
          nome_arquivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_anexos_financeiro_id_fkey"
            columns: ["financeiro_id"]
            isOneToOne: false
            referencedRelation: "financeiro"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_auditoria: {
        Row: {
          acao: string
          actor_id: string | null
          actor_nome: string | null
          created_at: string
          financeiro_id: string
          id: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          actor_id?: string | null
          actor_nome?: string | null
          created_at?: string
          financeiro_id: string
          id?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          actor_id?: string | null
          actor_nome?: string | null
          created_at?: string
          financeiro_id?: string
          id?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_auditoria_financeiro_id_fkey"
            columns: ["financeiro_id"]
            isOneToOne: false
            referencedRelation: "financeiro"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_pagamentos: {
        Row: {
          created_at: string
          estornado: boolean
          estornado_em: string | null
          estornado_por: string | null
          financeiro_id: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          observacoes: string | null
          pago_em: string
          parcela_id: string | null
          registrado_por: string
          valor_pago: number
        }
        Insert: {
          created_at?: string
          estornado?: boolean
          estornado_em?: string | null
          estornado_por?: string | null
          financeiro_id: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacoes?: string | null
          pago_em?: string
          parcela_id?: string | null
          registrado_por?: string
          valor_pago: number
        }
        Update: {
          created_at?: string
          estornado?: boolean
          estornado_em?: string | null
          estornado_por?: string | null
          financeiro_id?: string
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacoes?: string | null
          pago_em?: string
          parcela_id?: string | null
          registrado_por?: string
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_pagamentos_financeiro_id_fkey"
            columns: ["financeiro_id"]
            isOneToOne: false
            referencedRelation: "financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_pagamentos_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "financeiro_parcelas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_parcelas: {
        Row: {
          created_at: string
          financeiro_id: string
          id: string
          numero: number
          pago_em: string | null
          status_pagamento: Database["public"]["Enums"]["financeiro_status"]
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          created_at?: string
          financeiro_id: string
          id?: string
          numero: number
          pago_em?: string | null
          status_pagamento?: Database["public"]["Enums"]["financeiro_status"]
          updated_at?: string
          valor: number
          vencimento: string
        }
        Update: {
          created_at?: string
          financeiro_id?: string
          id?: string
          numero?: number
          pago_em?: string | null
          status_pagamento?: Database["public"]["Enums"]["financeiro_status"]
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_parcelas_financeiro_id_fkey"
            columns: ["financeiro_id"]
            isOneToOne: false
            referencedRelation: "financeiro"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          agendamento_id: string | null
          canal: Database["public"]["Enums"]["notif_canal"]
          created_at: string
          definitivo: boolean
          destinatario_email: string | null
          destinatario_telefone: string | null
          duracao_ms: number | null
          entregue_em: string | null
          enviado_em: string | null
          evento: Database["public"]["Enums"]["notif_evento"] | null
          id: string
          lida: boolean
          lido_em: string | null
          mensagem: string
          mensagem_recebida: string | null
          provider: string | null
          provider_message_id: string | null
          proxima_tentativa_em: string | null
          respondido_em: string | null
          status_envio: Database["public"]["Enums"]["notif_status_envio"]
          tentativas: number
          tipo: string
          titulo: string
          ultimo_erro: string | null
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          agendamento_id?: string | null
          canal?: Database["public"]["Enums"]["notif_canal"]
          created_at?: string
          definitivo?: boolean
          destinatario_email?: string | null
          destinatario_telefone?: string | null
          duracao_ms?: number | null
          entregue_em?: string | null
          enviado_em?: string | null
          evento?: Database["public"]["Enums"]["notif_evento"] | null
          id?: string
          lida?: boolean
          lido_em?: string | null
          mensagem: string
          mensagem_recebida?: string | null
          provider?: string | null
          provider_message_id?: string | null
          proxima_tentativa_em?: string | null
          respondido_em?: string | null
          status_envio?: Database["public"]["Enums"]["notif_status_envio"]
          tentativas?: number
          tipo?: string
          titulo: string
          ultimo_erro?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          agendamento_id?: string | null
          canal?: Database["public"]["Enums"]["notif_canal"]
          created_at?: string
          definitivo?: boolean
          destinatario_email?: string | null
          destinatario_telefone?: string | null
          duracao_ms?: number | null
          entregue_em?: string | null
          enviado_em?: string | null
          evento?: Database["public"]["Enums"]["notif_evento"] | null
          id?: string
          lida?: boolean
          lido_em?: string | null
          mensagem?: string
          mensagem_recebida?: string | null
          provider?: string | null
          provider_message_id?: string | null
          proxima_tentativa_em?: string | null
          respondido_em?: string | null
          status_envio?: Database["public"]["Enums"]["notif_status_envio"]
          tentativas?: number
          tipo?: string
          titulo?: string
          ultimo_erro?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_config: {
        Row: {
          conexao_erro: string | null
          conexao_status: string
          conexao_testada_em: string | null
          created_at: string
          destinatario_solicitacao: string
          id: string
          janela_ativa: boolean
          janela_fim: string
          janela_inicio: string
          lembrete_24h_ativo: boolean
          lembrete_2h_ativo: boolean
          provider: string
          provider_instancia: string | null
          provider_phone_number_id: string | null
          provider_token: string | null
          provider_url: string | null
          remetente: string | null
          templates: Json
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          conexao_erro?: string | null
          conexao_status?: string
          conexao_testada_em?: string | null
          created_at?: string
          destinatario_solicitacao?: string
          id?: string
          janela_ativa?: boolean
          janela_fim?: string
          janela_inicio?: string
          lembrete_24h_ativo?: boolean
          lembrete_2h_ativo?: boolean
          provider?: string
          provider_instancia?: string | null
          provider_phone_number_id?: string | null
          provider_token?: string | null
          provider_url?: string | null
          remetente?: string | null
          templates?: Json
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          conexao_erro?: string | null
          conexao_status?: string
          conexao_testada_em?: string | null
          created_at?: string
          destinatario_solicitacao?: string
          id?: string
          janela_ativa?: boolean
          janela_fim?: string
          janela_inicio?: string
          lembrete_24h_ativo?: boolean
          lembrete_2h_ativo?: boolean
          provider?: string
          provider_instancia?: string | null
          provider_phone_number_id?: string | null
          provider_token?: string | null
          provider_url?: string | null
          remetente?: string | null
          templates?: Json
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      pacientes: {
        Row: {
          created_at: string
          data_nascimento: string | null
          email: string | null
          foto_url: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          desativado_em: string | null
          desativado_por: string | null
          email: string
          foto_url: string | null
          id: string
          nome: string
          removido_em: string | null
          removido_por: string | null
          telefone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          desativado_em?: string | null
          desativado_por?: string | null
          email: string
          foto_url?: string | null
          id: string
          nome?: string
          removido_em?: string | null
          removido_por?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          desativado_em?: string | null
          desativado_por?: string | null
          email?: string
          foto_url?: string | null
          id?: string
          nome?: string
          removido_em?: string | null
          removido_por?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      profissionais: {
        Row: {
          anos_experiencia: number | null
          created_at: string
          descricao: string | null
          duracao_consulta_min: number | null
          email: string | null
          especialidade_id: string | null
          formacao: string | null
          foto_url: string | null
          id: string
          nome: string
          registro_profissional: string | null
          status: Database["public"]["Enums"]["profissional_status"]
          telefone: string | null
          updated_at: string
          user_id: string | null
          valor_consulta_avista: number | null
          valor_consulta_cartao: number | null
          whatsapp: string | null
        }
        Insert: {
          anos_experiencia?: number | null
          created_at?: string
          descricao?: string | null
          duracao_consulta_min?: number | null
          email?: string | null
          especialidade_id?: string | null
          formacao?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          registro_profissional?: string | null
          status?: Database["public"]["Enums"]["profissional_status"]
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
          valor_consulta_avista?: number | null
          valor_consulta_cartao?: number | null
          whatsapp?: string | null
        }
        Update: {
          anos_experiencia?: number | null
          created_at?: string
          descricao?: string | null
          duracao_consulta_min?: number | null
          email?: string | null
          especialidade_id?: string | null
          formacao?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          registro_profissional?: string | null
          status?: Database["public"]["Enums"]["profissional_status"]
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
          valor_consulta_avista?: number | null
          valor_consulta_cartao?: number | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profissionais_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
        ]
      }
      profissional_bloqueio: {
        Row: {
          created_at: string
          data: string
          hora_fim: string
          hora_inicio: string
          id: string
          motivo: string | null
          profissional_id: string
        }
        Insert: {
          created_at?: string
          data: string
          hora_fim: string
          hora_inicio: string
          id?: string
          motivo?: string | null
          profissional_id: string
        }
        Update: {
          created_at?: string
          data?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          motivo?: string | null
          profissional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profissional_bloqueio_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_bloqueio_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profissional_disponibilidade: {
        Row: {
          created_at: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
          profissional_id: string
        }
        Insert: {
          created_at?: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: string
          profissional_id: string
        }
        Update: {
          created_at?: string
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          profissional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profissional_disponibilidade_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_disponibilidade_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_audit_log: {
        Row: {
          acao: string
          actor_id: string | null
          actor_nome: string | null
          created_at: string
          detalhes: string | null
          id: string
          target_nome: string | null
          target_user_id: string | null
        }
        Insert: {
          acao: string
          actor_id?: string | null
          actor_nome?: string | null
          created_at?: string
          detalhes?: string | null
          id?: string
          target_nome?: string | null
          target_user_id?: string | null
        }
        Update: {
          acao?: string
          actor_id?: string | null
          actor_nome?: string | null
          created_at?: string
          detalhes?: string | null
          id?: string
          target_nome?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_evento_templates: {
        Row: {
          ativo: boolean
          created_at: string
          evento: string
          id: string
          language: string
          template_name: string | null
          updated_at: string
          variaveis: Json
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          evento: string
          id?: string
          language?: string
          template_name?: string | null
          updated_at?: string
          variaveis?: Json
        }
        Update: {
          ativo?: boolean
          created_at?: string
          evento?: string
          id?: string
          language?: string
          template_name?: string | null
          updated_at?: string
          variaveis?: Json
        }
        Relationships: []
      }
      whatsapp_message_logs: {
        Row: {
          accepted_at: string | null
          agendamento_id: string | null
          conversation_category: string | null
          conversation_id: string | null
          created_at: string
          delivered_at: string | null
          destinatario_telefone: string
          duracao_ms: number | null
          erro_codigo: string | null
          erro_detalhe: string | null
          evento: string | null
          failed_at: string | null
          id: string
          mensagem: string | null
          mensagem_recebida: string | null
          message_status: string | null
          paciente_nome: string | null
          payload: Json | null
          profissional_nome: string | null
          read_at: string | null
          sent_at: string | null
          status_envio: string
          template_name: string | null
          ultimo_erro: string | null
          wamid: string | null
          webhook_payload: Json | null
        }
        Insert: {
          accepted_at?: string | null
          agendamento_id?: string | null
          conversation_category?: string | null
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          destinatario_telefone: string
          duracao_ms?: number | null
          erro_codigo?: string | null
          erro_detalhe?: string | null
          evento?: string | null
          failed_at?: string | null
          id?: string
          mensagem?: string | null
          mensagem_recebida?: string | null
          message_status?: string | null
          paciente_nome?: string | null
          payload?: Json | null
          profissional_nome?: string | null
          read_at?: string | null
          sent_at?: string | null
          status_envio?: string
          template_name?: string | null
          ultimo_erro?: string | null
          wamid?: string | null
          webhook_payload?: Json | null
        }
        Update: {
          accepted_at?: string | null
          agendamento_id?: string | null
          conversation_category?: string | null
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          destinatario_telefone?: string
          duracao_ms?: number | null
          erro_codigo?: string | null
          erro_detalhe?: string | null
          evento?: string | null
          failed_at?: string | null
          id?: string
          mensagem?: string | null
          mensagem_recebida?: string | null
          message_status?: string | null
          paciente_nome?: string | null
          payload?: Json | null
          profissional_nome?: string | null
          read_at?: string | null
          sent_at?: string | null
          status_envio?: string
          template_name?: string | null
          ultimo_erro?: string | null
          wamid?: string | null
          webhook_payload?: Json | null
        }
        Relationships: []
      }
      whatsapp_meta_config: {
        Row: {
          access_token: string | null
          app_id: string | null
          app_secret: string | null
          business_account_id: string | null
          created_at: string
          graph_version: string
          id: string
          phone_number_id: string | null
          updated_at: string
          verify_token: string | null
        }
        Insert: {
          access_token?: string | null
          app_id?: string | null
          app_secret?: string | null
          business_account_id?: string | null
          created_at?: string
          graph_version?: string
          id?: string
          phone_number_id?: string | null
          updated_at?: string
          verify_token?: string | null
        }
        Update: {
          access_token?: string | null
          app_id?: string | null
          app_secret?: string | null
          business_account_id?: string | null
          created_at?: string
          graph_version?: string
          id?: string
          phone_number_id?: string | null
          updated_at?: string
          verify_token?: string | null
        }
        Relationships: []
      }
      whatsapp_queue: {
        Row: {
          created_at: string
          destinatario: string
          enviado_em: string | null
          erro: string | null
          id: string
          mensagem: string
          status: Database["public"]["Enums"]["wa_status"]
          tentativas: number
        }
        Insert: {
          created_at?: string
          destinatario: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          mensagem: string
          status?: Database["public"]["Enums"]["wa_status"]
          tentativas?: number
        }
        Update: {
          created_at?: string
          destinatario?: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          mensagem?: string
          status?: Database["public"]["Enums"]["wa_status"]
          tentativas?: number
        }
        Relationships: []
      }
      whatsapp_sessions: {
        Row: {
          last_inbound_at: string
          telefone: string
          updated_at: string
        }
        Insert: {
          last_inbound_at?: string
          telefone: string
          updated_at?: string
        }
        Update: {
          last_inbound_at?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          body_text: string
          buttons: Json
          category: string
          created_at: string
          footer_text: string | null
          header_text: string | null
          id: string
          language: string
          meta_created_at: string | null
          meta_id: string | null
          meta_updated_at: string | null
          name: string
          quality_rating: string | null
          rejected_reason: string | null
          status: string
          synced_at: string | null
          titulo_interno: string | null
          updated_at: string
          variaveis: Json
        }
        Insert: {
          body_text?: string
          buttons?: Json
          category?: string
          created_at?: string
          footer_text?: string | null
          header_text?: string | null
          id?: string
          language?: string
          meta_created_at?: string | null
          meta_id?: string | null
          meta_updated_at?: string | null
          name: string
          quality_rating?: string | null
          rejected_reason?: string | null
          status?: string
          synced_at?: string | null
          titulo_interno?: string | null
          updated_at?: string
          variaveis?: Json
        }
        Update: {
          body_text?: string
          buttons?: Json
          category?: string
          created_at?: string
          footer_text?: string | null
          header_text?: string | null
          id?: string
          language?: string
          meta_created_at?: string | null
          meta_id?: string | null
          meta_updated_at?: string | null
          name?: string
          quality_rating?: string | null
          rejected_reason?: string | null
          status?: string
          synced_at?: string | null
          titulo_interno?: string | null
          updated_at?: string
          variaveis?: Json
        }
        Relationships: []
      }
    }
    Views: {
      profissionais_public: {
        Row: {
          anos_experiencia: number | null
          created_at: string | null
          descricao: string | null
          duracao_consulta_min: number | null
          especialidade_id: string | null
          formacao: string | null
          foto_url: string | null
          id: string | null
          nome: string | null
          registro_profissional: string | null
          status: Database["public"]["Enums"]["profissional_status"] | null
          valor_consulta_avista: number | null
          valor_consulta_cartao: number | null
        }
        Insert: {
          anos_experiencia?: number | null
          created_at?: string | null
          descricao?: string | null
          duracao_consulta_min?: number | null
          especialidade_id?: string | null
          formacao?: string | null
          foto_url?: string | null
          id?: string | null
          nome?: string | null
          registro_profissional?: string | null
          status?: Database["public"]["Enums"]["profissional_status"] | null
          valor_consulta_avista?: number | null
          valor_consulta_cartao?: number | null
        }
        Update: {
          anos_experiencia?: number | null
          created_at?: string | null
          descricao?: string | null
          duracao_consulta_min?: number | null
          especialidade_id?: string | null
          formacao?: string | null
          foto_url?: string | null
          id?: string | null
          nome?: string | null
          registro_profissional?: string | null
          status?: Database["public"]["Enums"]["profissional_status"] | null
          valor_consulta_avista?: number | null
          valor_consulta_cartao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profissionais_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_user_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      enqueue_notificacao: {
        Args: {
          _agendamento_id?: string
          _canal?: Database["public"]["Enums"]["notif_canal"]
          _email?: string
          _evento: Database["public"]["Enums"]["notif_evento"]
          _mensagem: string
          _telefone?: string
          _titulo: string
          _usuario_id: string
        }
        Returns: string
      }
      financeiro_evolucao_mensal: {
        Args: { p_meses?: number }
        Returns: {
          aberto: number
          mes: string
          qtd: number
          recebido: number
        }[]
      }
      gerar_lembretes: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      horarios_disponiveis: {
        Args: { p_data: string; p_profissional_id: string }
        Returns: {
          hora_fim: string
          hora_inicio: string
        }[]
      }
      normalizar_whatsapp: { Args: { _valor: string }; Returns: string }
      notif_config: {
        Args: never
        Returns: {
          conexao_erro: string | null
          conexao_status: string
          conexao_testada_em: string | null
          created_at: string
          destinatario_solicitacao: string
          id: string
          janela_ativa: boolean
          janela_fim: string
          janela_inicio: string
          lembrete_24h_ativo: boolean
          lembrete_2h_ativo: boolean
          provider: string
          provider_instancia: string | null
          provider_phone_number_id: string | null
          provider_token: string | null
          provider_url: string | null
          remetente: string | null
          templates: Json
          updated_at: string
          webhook_secret: string | null
        }
        SetofOptions: {
          from: "*"
          to: "notificacoes_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recalcular_status_financeiro: {
        Args: { p_financeiro_id: string }
        Returns: undefined
      }
      resolve_valor_consulta: {
        Args: { _forma_pagamento: string; _profissional_id: string }
        Returns: number
      }
    }
    Enums: {
      agendamento_status:
        | "PENDENTE"
        | "APROVADO"
        | "RECUSADO"
        | "CANCELADO"
        | "REMARCADO"
        | "FINALIZADO"
      app_role: "ADMIN" | "RECEPCIONISTA" | "PROFISSIONAL" | "CLIENTE"
      financeiro_status: "ABERTO" | "PAGO" | "CANCELADO" | "PARCIAL"
      forma_pagamento:
        | "DINHEIRO"
        | "PIX"
        | "CARTAO_DEBITO"
        | "CARTAO_CREDITO"
        | "OUTRO"
      notif_canal: "WHATSAPP" | "EMAIL" | "INTERNO"
      notif_evento:
        | "SOLICITACAO_NOVA"
        | "CONSULTA_APROVADA"
        | "CONSULTA_RECUSADA"
        | "CONSULTA_CANCELADA"
        | "CONSULTA_REMARCADA"
        | "LEMBRETE_24H"
        | "PAGAMENTO_CONFIRMADO"
        | "LEMBRETE_2H"
      notif_status_envio:
        | "PENDENTE"
        | "ENVIANDO"
        | "ENVIADA"
        | "ERRO"
        | "CANCELADA"
        | "ENTREGUE"
        | "LIDO"
        | "RESPONDIDO"
      profissional_status: "ATIVO" | "INATIVO"
      wa_status: "PENDENTE" | "ENVIADO" | "FALHOU"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agendamento_status: [
        "PENDENTE",
        "APROVADO",
        "RECUSADO",
        "CANCELADO",
        "REMARCADO",
        "FINALIZADO",
      ],
      app_role: ["ADMIN", "RECEPCIONISTA", "PROFISSIONAL", "CLIENTE"],
      financeiro_status: ["ABERTO", "PAGO", "CANCELADO", "PARCIAL"],
      forma_pagamento: [
        "DINHEIRO",
        "PIX",
        "CARTAO_DEBITO",
        "CARTAO_CREDITO",
        "OUTRO",
      ],
      notif_canal: ["WHATSAPP", "EMAIL", "INTERNO"],
      notif_evento: [
        "SOLICITACAO_NOVA",
        "CONSULTA_APROVADA",
        "CONSULTA_RECUSADA",
        "CONSULTA_CANCELADA",
        "CONSULTA_REMARCADA",
        "LEMBRETE_24H",
        "PAGAMENTO_CONFIRMADO",
        "LEMBRETE_2H",
      ],
      notif_status_envio: [
        "PENDENTE",
        "ENVIANDO",
        "ENVIADA",
        "ERRO",
        "CANCELADA",
        "ENTREGUE",
        "LIDO",
        "RESPONDIDO",
      ],
      profissional_status: ["ATIVO", "INATIVO"],
      wa_status: ["PENDENTE", "ENVIADO", "FALHOU"],
    },
  },
} as const
