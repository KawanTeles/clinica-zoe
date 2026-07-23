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
        ]
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
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          paciente_id: string | null
          pago_em: string | null
          profissional_id: string | null
          status_pagamento: Database["public"]["Enums"]["financeiro_status"]
          updated_at: string
          valor: number
        }
        Insert: {
          agendamento_id?: string | null
          created_at?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          paciente_id?: string | null
          pago_em?: string | null
          profissional_id?: string | null
          status_pagamento?: Database["public"]["Enums"]["financeiro_status"]
          updated_at?: string
          valor?: number
        }
        Update: {
          agendamento_id?: string | null
          created_at?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          paciente_id?: string | null
          pago_em?: string | null
          profissional_id?: string | null
          status_pagamento?: Database["public"]["Enums"]["financeiro_status"]
          updated_at?: string
          valor?: number
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
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem: string
          tipo?: string
          titulo: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      pacientes: {
        Row: {
          created_at: string
          data_nascimento: string | null
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profissionais: {
        Row: {
          created_at: string
          descricao: string | null
          duracao_consulta_min: number | null
          email: string | null
          especialidade_id: string | null
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
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          duracao_consulta_min?: number | null
          email?: string | null
          especialidade_id?: string | null
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
        }
        Update: {
          created_at?: string
          descricao?: string | null
          duracao_consulta_min?: number | null
          email?: string | null
          especialidade_id?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      financeiro_status: "ABERTO" | "PAGO" | "CANCELADO"
      forma_pagamento:
        | "DINHEIRO"
        | "PIX"
        | "CARTAO_DEBITO"
        | "CARTAO_CREDITO"
        | "OUTRO"
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
      financeiro_status: ["ABERTO", "PAGO", "CANCELADO"],
      forma_pagamento: [
        "DINHEIRO",
        "PIX",
        "CARTAO_DEBITO",
        "CARTAO_CREDITO",
        "OUTRO",
      ],
      profissional_status: ["ATIVO", "INATIVO"],
      wa_status: ["PENDENTE", "ENVIADO", "FALHOU"],
    },
  },
} as const
