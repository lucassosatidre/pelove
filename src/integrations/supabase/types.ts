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
      actions: {
        Row: {
          area: string | null
          bg_color: string | null
          created_at: string | null
          deadline: string | null
          deliverable: string | null
          description: string
          execution_order: number | null
          expected_result: string | null
          id: string
          importance: number | null
          is_bold: boolean | null
          obstacle_id: string
          priority_score: number | null
          reliability: number | null
          responsible: string | null
          status: string
          text_color: string | null
          updated_at: string | null
          urgency: number | null
        }
        Insert: {
          area?: string | null
          bg_color?: string | null
          created_at?: string | null
          deadline?: string | null
          deliverable?: string | null
          description: string
          execution_order?: number | null
          expected_result?: string | null
          id?: string
          importance?: number | null
          is_bold?: boolean | null
          obstacle_id: string
          priority_score?: number | null
          reliability?: number | null
          responsible?: string | null
          status?: string
          text_color?: string | null
          updated_at?: string | null
          urgency?: number | null
        }
        Update: {
          area?: string | null
          bg_color?: string | null
          created_at?: string | null
          deadline?: string | null
          deliverable?: string | null
          description?: string
          execution_order?: number | null
          expected_result?: string | null
          id?: string
          importance?: number | null
          is_bold?: boolean | null
          obstacle_id?: string
          priority_score?: number | null
          reliability?: number | null
          responsible?: string | null
          status?: string
          text_color?: string | null
          updated_at?: string | null
          urgency?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "actions_obstacle_id_fkey"
            columns: ["obstacle_id"]
            isOneToOne: false
            referencedRelation: "obstacles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_statuses: {
        Row: {
          color: string
          created_at: string | null
          display_order: number
          id: string
          is_default: boolean
          label: string
          value: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          display_order?: number
          id?: string
          is_default?: boolean
          label: string
          value: string
        }
        Update: {
          color?: string
          created_at?: string | null
          display_order?: number
          id?: string
          is_default?: boolean
          label?: string
          value?: string
        }
        Relationships: []
      }
      obstacles: {
        Row: {
          bg_color: string | null
          code: string
          created_at: string | null
          description: string | null
          display_order: number
          id: string
          is_bold: boolean | null
          pillar_id: string
          text_color: string | null
          updated_at: string | null
        }
        Insert: {
          bg_color?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_bold?: boolean | null
          pillar_id: string
          text_color?: string | null
          updated_at?: string | null
        }
        Update: {
          bg_color?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_bold?: boolean | null
          pillar_id?: string
          text_color?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obstacles_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      pillars: {
        Row: {
          bg_color: string | null
          created_at: string | null
          display_order: number
          id: string
          is_bold: boolean | null
          name: string
          number: number
          text_color: string | null
          updated_at: string | null
        }
        Insert: {
          bg_color?: string | null
          created_at?: string | null
          display_order: number
          id?: string
          is_bold?: boolean | null
          name: string
          number: number
          text_color?: string | null
          updated_at?: string | null
        }
        Update: {
          bg_color?: string | null
          created_at?: string | null
          display_order?: number
          id?: string
          is_bold?: boolean | null
          name?: string
          number?: number
          text_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vision: {
        Row: {
          created_at: string | null
          id: string
          reference_year: number
          text: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          reference_year?: number
          text: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          reference_year?: number
          text?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
