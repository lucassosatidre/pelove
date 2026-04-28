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
      advisor_conversations: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          last_message_at: string
          message_count: number
          pinned: boolean
          title: string | null
          total_input_tokens: number
          total_output_tokens: number
          user_id: string | null
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          last_message_at?: string
          message_count?: number
          pinned?: boolean
          title?: string | null
          total_input_tokens?: number
          total_output_tokens?: number
          user_id?: string | null
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          last_message_at?: string
          message_count?: number
          pinned?: boolean
          title?: string | null
          total_input_tokens?: number
          total_output_tokens?: number
          user_id?: string | null
        }
        Relationships: []
      }
      advisor_facts: {
        Row: {
          confidence: number | null
          created_at: string
          fact: string
          id: string
          source_conversation_id: string | null
          topic: string
          updated_at: string
          user_confirmed: boolean
          user_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          fact: string
          id?: string
          source_conversation_id?: string | null
          topic?: string
          updated_at?: string
          user_confirmed?: boolean
          user_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          fact?: string
          id?: string
          source_conversation_id?: string | null
          topic?: string
          updated_at?: string
          user_confirmed?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advisor_facts_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "advisor_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_insights: {
        Row: {
          body: string
          created_at: string
          dismissed: boolean
          dismissed_at: string | null
          domain: string
          for_date: string
          generated_by: string
          generation_model: string | null
          id: string
          metadata: Json | null
          severity: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          dismissed?: boolean
          dismissed_at?: string | null
          domain?: string
          for_date: string
          generated_by?: string
          generation_model?: string | null
          id?: string
          metadata?: Json | null
          severity?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          dismissed?: boolean
          dismissed_at?: string | null
          domain?: string
          for_date?: string
          generated_by?: string
          generation_model?: string | null
          id?: string
          metadata?: Json | null
          severity?: string
          title?: string
        }
        Relationships: []
      }
      advisor_messages: {
        Row: {
          cache_creation_input_tokens: number | null
          cache_read_input_tokens: number | null
          content: Json
          conversation_id: string
          created_at: string
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          role: string
          stop_reason: string | null
          tool_calls: Json | null
          tool_results: Json | null
        }
        Insert: {
          cache_creation_input_tokens?: number | null
          cache_read_input_tokens?: number | null
          content: Json
          conversation_id: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          role: string
          stop_reason?: string | null
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          cache_creation_input_tokens?: number | null
          cache_read_input_tokens?: number | null
          content?: Json
          conversation_id?: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          role?: string
          stop_reason?: string | null
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "advisor_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "advisor_conversations"
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
      saipos_backfill_progress: {
        Row: {
          attempted_at: string | null
          completed_at: string | null
          endpoint: string
          error_message: string | null
          id: number
          records_imported: number | null
          status: string
          window_end: string
          window_start: string
        }
        Insert: {
          attempted_at?: string | null
          completed_at?: string | null
          endpoint: string
          error_message?: string | null
          id?: number
          records_imported?: number | null
          status?: string
          window_end: string
          window_start: string
        }
        Update: {
          attempted_at?: string | null
          completed_at?: string | null
          endpoint?: string
          error_message?: string | null
          id?: number
          records_imported?: number | null
          status?: string
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      saipos_config: {
        Row: {
          backfill_completed_at: string | null
          backfill_start_date: string | null
          created_at: string
          id: string
          is_enabled: boolean
          last_daily_sync_at: string | null
          last_incremental_sync_at: string | null
          last_old_data_check_at: string | null
          old_data_check_enabled: boolean
          old_data_check_window_days: number
          store_id: number | null
          updated_at: string
        }
        Insert: {
          backfill_completed_at?: string | null
          backfill_start_date?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_daily_sync_at?: string | null
          last_incremental_sync_at?: string | null
          last_old_data_check_at?: string | null
          old_data_check_enabled?: boolean
          old_data_check_window_days?: number
          store_id?: number | null
          updated_at?: string
        }
        Update: {
          backfill_completed_at?: string | null
          backfill_start_date?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_daily_sync_at?: string | null
          last_incremental_sync_at?: string | null
          last_old_data_check_at?: string | null
          old_data_check_enabled?: boolean
          old_data_check_window_days?: number
          store_id?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      saipos_financial: {
        Row: {
          amount: number | null
          conciliated: boolean | null
          created_at: string | null
          date: string | null
          desc_store_bank_account: string | null
          desc_store_category_financial: string | null
          desc_store_fin_transaction: string | null
          desc_store_payment_method: string | null
          id_store: number | null
          id_store_fin_transaction: number
          installment: number | null
          issuance_date: string | null
          notes: string | null
          paid: boolean | null
          payment_date: string | null
          provider_trade_name: string | null
          raw_payload: Json
          recurring: boolean | null
          saipos_synced_at: string
          total_installments: number | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          conciliated?: boolean | null
          created_at?: string | null
          date?: string | null
          desc_store_bank_account?: string | null
          desc_store_category_financial?: string | null
          desc_store_fin_transaction?: string | null
          desc_store_payment_method?: string | null
          id_store?: number | null
          id_store_fin_transaction: number
          installment?: number | null
          issuance_date?: string | null
          notes?: string | null
          paid?: boolean | null
          payment_date?: string | null
          provider_trade_name?: string | null
          raw_payload: Json
          recurring?: boolean | null
          saipos_synced_at?: string
          total_installments?: number | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          conciliated?: boolean | null
          created_at?: string | null
          date?: string | null
          desc_store_bank_account?: string | null
          desc_store_category_financial?: string | null
          desc_store_fin_transaction?: string | null
          desc_store_payment_method?: string | null
          id_store?: number | null
          id_store_fin_transaction?: number
          installment?: number | null
          issuance_date?: string | null
          notes?: string | null
          paid?: boolean | null
          payment_date?: string | null
          provider_trade_name?: string | null
          raw_payload?: Json
          recurring?: boolean | null
          saipos_synced_at?: string
          total_installments?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      saipos_sales: {
        Row: {
          canceled: boolean | null
          count_canceled_items: number | null
          created_at: string | null
          customer_document: string | null
          customer_id_customer: number | null
          customer_name: string | null
          customer_phone: string | null
          delivery_city: string | null
          delivery_fee: number | null
          delivery_man_name: string | null
          delivery_neighborhood: string | null
          desc_sale: string | null
          id_sale: number
          id_sale_type: number | null
          id_store: number | null
          nfce_data_emissao: string | null
          nfce_numero: number | null
          nfce_serie: string | null
          partner_cod_sale1: string | null
          partner_desc: string | null
          partner_status: string | null
          raw_payload: Json
          saipos_synced_at: string
          sale_number: number | null
          schedule_datetime: string | null
          shift_date: string | null
          store_shift_desc: string | null
          store_shift_starting_time: string | null
          table_customers_count: number | null
          table_id_table: number | null
          table_service_charge_percent: number | null
          table_total_service_charge: number | null
          ticket_number: number | null
          total_amount: number | null
          total_amount_items: number | null
          total_discount: number | null
          total_increase: number | null
          updated_at: string | null
        }
        Insert: {
          canceled?: boolean | null
          count_canceled_items?: number | null
          created_at?: string | null
          customer_document?: string | null
          customer_id_customer?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_city?: string | null
          delivery_fee?: number | null
          delivery_man_name?: string | null
          delivery_neighborhood?: string | null
          desc_sale?: string | null
          id_sale: number
          id_sale_type?: number | null
          id_store?: number | null
          nfce_data_emissao?: string | null
          nfce_numero?: number | null
          nfce_serie?: string | null
          partner_cod_sale1?: string | null
          partner_desc?: string | null
          partner_status?: string | null
          raw_payload: Json
          saipos_synced_at?: string
          sale_number?: number | null
          schedule_datetime?: string | null
          shift_date?: string | null
          store_shift_desc?: string | null
          store_shift_starting_time?: string | null
          table_customers_count?: number | null
          table_id_table?: number | null
          table_service_charge_percent?: number | null
          table_total_service_charge?: number | null
          ticket_number?: number | null
          total_amount?: number | null
          total_amount_items?: number | null
          total_discount?: number | null
          total_increase?: number | null
          updated_at?: string | null
        }
        Update: {
          canceled?: boolean | null
          count_canceled_items?: number | null
          created_at?: string | null
          customer_document?: string | null
          customer_id_customer?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_city?: string | null
          delivery_fee?: number | null
          delivery_man_name?: string | null
          delivery_neighborhood?: string | null
          desc_sale?: string | null
          id_sale?: number
          id_sale_type?: number | null
          id_store?: number | null
          nfce_data_emissao?: string | null
          nfce_numero?: number | null
          nfce_serie?: string | null
          partner_cod_sale1?: string | null
          partner_desc?: string | null
          partner_status?: string | null
          raw_payload?: Json
          saipos_synced_at?: string
          sale_number?: number | null
          schedule_datetime?: string | null
          shift_date?: string | null
          store_shift_desc?: string | null
          store_shift_starting_time?: string | null
          table_customers_count?: number | null
          table_id_table?: number | null
          table_service_charge_percent?: number | null
          table_total_service_charge?: number | null
          ticket_number?: number | null
          total_amount?: number | null
          total_amount_items?: number | null
          total_discount?: number | null
          total_increase?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      saipos_sales_items: {
        Row: {
          created_by: number | null
          deleted: boolean | null
          deleted_at: string | null
          deleted_by: number | null
          desc_sale_item: string | null
          done_at: string | null
          group_sequence: number | null
          id_sale: number
          id_sale_from: number | null
          id_sale_item: number
          id_sale_to: number | null
          id_sale_type: number | null
          id_store: number | null
          id_store_cancellation_reason: number | null
          id_store_item: number | null
          id_store_variation: number | null
          id_store_waiter: number | null
          integration_code: string | null
          item_created_at: string | null
          item_updated_at: string | null
          normalized_name: string | null
          quantity: number | null
          raw_payload: Json
          saipos_synced_at: string
          shift_date: string | null
          status: number | null
          unit_price: number | null
        }
        Insert: {
          created_by?: number | null
          deleted?: boolean | null
          deleted_at?: string | null
          deleted_by?: number | null
          desc_sale_item?: string | null
          done_at?: string | null
          group_sequence?: number | null
          id_sale: number
          id_sale_from?: number | null
          id_sale_item: number
          id_sale_to?: number | null
          id_sale_type?: number | null
          id_store?: number | null
          id_store_cancellation_reason?: number | null
          id_store_item?: number | null
          id_store_variation?: number | null
          id_store_waiter?: number | null
          integration_code?: string | null
          item_created_at?: string | null
          item_updated_at?: string | null
          normalized_name?: string | null
          quantity?: number | null
          raw_payload: Json
          saipos_synced_at?: string
          shift_date?: string | null
          status?: number | null
          unit_price?: number | null
        }
        Update: {
          created_by?: number | null
          deleted?: boolean | null
          deleted_at?: string | null
          deleted_by?: number | null
          desc_sale_item?: string | null
          done_at?: string | null
          group_sequence?: number | null
          id_sale?: number
          id_sale_from?: number | null
          id_sale_item?: number
          id_sale_to?: number | null
          id_sale_type?: number | null
          id_store?: number | null
          id_store_cancellation_reason?: number | null
          id_store_item?: number | null
          id_store_variation?: number | null
          id_store_waiter?: number | null
          integration_code?: string | null
          item_created_at?: string | null
          item_updated_at?: string | null
          normalized_name?: string | null
          quantity?: number | null
          raw_payload?: Json
          saipos_synced_at?: string
          shift_date?: string | null
          status?: number | null
          unit_price?: number | null
        }
        Relationships: []
      }
      saipos_status_history: {
        Row: {
          authorized_by_full_name: string | null
          authorized_by_id_user: number | null
          desc_cancellation_reason: string | null
          desc_store_sale_status: string | null
          display_order: number | null
          duration_time_seconds: number | null
          history_created_at: string | null
          id_sale: number
          id_sale_status_history: number
          id_store: number | null
          raw_payload: Json
          saipos_synced_at: string
          shift_date: string | null
          user_email: string | null
          user_full_name: string | null
          user_id_user: number | null
          user_type: number | null
        }
        Insert: {
          authorized_by_full_name?: string | null
          authorized_by_id_user?: number | null
          desc_cancellation_reason?: string | null
          desc_store_sale_status?: string | null
          display_order?: number | null
          duration_time_seconds?: number | null
          history_created_at?: string | null
          id_sale: number
          id_sale_status_history: number
          id_store?: number | null
          raw_payload: Json
          saipos_synced_at?: string
          shift_date?: string | null
          user_email?: string | null
          user_full_name?: string | null
          user_id_user?: number | null
          user_type?: number | null
        }
        Update: {
          authorized_by_full_name?: string | null
          authorized_by_id_user?: number | null
          desc_cancellation_reason?: string | null
          desc_store_sale_status?: string | null
          display_order?: number | null
          duration_time_seconds?: number | null
          history_created_at?: string | null
          id_sale?: number
          id_sale_status_history?: number
          id_store?: number | null
          raw_payload?: Json
          saipos_synced_at?: string
          shift_date?: string | null
          user_email?: string | null
          user_full_name?: string | null
          user_id_user?: number | null
          user_type?: number | null
        }
        Relationships: []
      }
      saipos_sync_runs: {
        Row: {
          date_column: string | null
          duration_ms: number | null
          endpoint: string
          error_message: string | null
          finished_at: string | null
          http_status: number | null
          id: number
          period_end: string | null
          period_start: string | null
          records_received: number | null
          records_upserted: number | null
          run_type: string
          started_at: string
          status: string
        }
        Insert: {
          date_column?: string | null
          duration_ms?: number | null
          endpoint: string
          error_message?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: number
          period_end?: string | null
          period_start?: string | null
          records_received?: number | null
          records_upserted?: number | null
          run_type: string
          started_at?: string
          status?: string
        }
        Update: {
          date_column?: string | null
          duration_ms?: number | null
          endpoint?: string
          error_message?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: number
          period_end?: string | null
          period_start?: string | null
          records_received?: number | null
          records_upserted?: number | null
          run_type?: string
          started_at?: string
          status?: string
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
      date_bucket: {
        Args: { p_date: string; p_granularity: string }
        Returns: string
      }
      get_cancellations: {
        Args: { p_end: string; p_sale_types?: number[]; p_start: string }
        Returns: {
          by_day: Json
          by_reason: Json
          cancellation_rate_pct: number
          total_cancellation_value: number
          total_cancellations: number
        }[]
      }
      get_data_coverage: {
        Args: never
        Returns: {
          earliest_date: string
          latest_date: string
          total_sales: number
        }[]
      }
      get_delivery_time_metrics: {
        Args: { p_end: string; p_start: string }
        Returns: {
          avg_minutes: number
          median_minutes: number
          p90_minutes: number
          total_delivery_orders: number
        }[]
      }
      get_product_by_dow: {
        Args: {
          p_end: string
          p_sale_types?: number[]
          p_start: string
          p_top_products?: number
        }
        Returns: {
          display_name: string
          dow: number
          normalized_name: string
          orders: number
          quantity: number
        }[]
      }
      get_product_by_hour: {
        Args: {
          p_end: string
          p_sale_types?: number[]
          p_start: string
          p_top_products?: number
        }
        Returns: {
          display_name: string
          hour: number
          normalized_name: string
          orders: number
          quantity: number
        }[]
      }
      get_sales_by_shift: {
        Args: { p_end: string; p_sale_types?: number[]; p_start: string }
        Returns: {
          orders: number
          revenue: number
          shift_label: string
          starting_time: string
        }[]
      }
      get_sales_by_type: {
        Args: { p_end: string; p_start: string }
        Returns: {
          id_sale_type: number
          orders: number
          revenue: number
          type_label: string
        }[]
      }
      get_sales_heatmap: {
        Args: { p_end: string; p_sale_types?: number[]; p_start: string }
        Returns: {
          dow: number
          hour: number
          orders: number
          revenue: number
        }[]
      }
      get_sales_series: {
        Args: {
          p_end: string
          p_granularity?: string
          p_sale_types?: number[]
          p_start: string
        }
        Returns: {
          bucket: string
          orders: number
          revenue: number
        }[]
      }
      get_sales_totals: {
        Args: { p_end: string; p_sale_types?: number[]; p_start: string }
        Returns: {
          avg_ticket: number
          total_orders: number
          total_revenue: number
        }[]
      }
      get_service_charge_metrics: {
        Args: { p_end: string; p_start: string }
        Returns: {
          refused_pct: number
          total_charged: number
          total_orders_with_charge: number
          total_paid_estimated: number
          total_refused_estimated: number
        }[]
      }
      get_slowest_orders: {
        Args: {
          p_end: string
          p_limit?: number
          p_sale_types?: number[]
          p_start: string
        }
        Returns: {
          created_at: string
          id_sale: number
          id_sale_type: number
          partner_desc: string
          shift_date: string
          total_amount: number
          total_seconds: number
          type_label: string
          worst_status: string
          worst_status_seconds: number
        }[]
      }
      get_status_avg_times: {
        Args: { p_end: string; p_sale_types?: number[]; p_start: string }
        Returns: {
          avg_seconds: number
          median_seconds: number
          p90_seconds: number
          status_label: string
          total_events: number
        }[]
      }
      get_table_metrics: {
        Args: { p_end: string; p_start: string }
        Returns: {
          avg_customers_per_table: number
          avg_minutes_open: number
          avg_table_revenue: number
          total_customers: number
          total_revenue: number
          total_table_orders: number
        }[]
      }
      get_top_addons: {
        Args: {
          p_end: string
          p_limit?: number
          p_sale_types?: number[]
          p_start: string
        }
        Returns: {
          addon_name: string
          parent_products: string[]
          total_additional_value: number
          uses: number
        }[]
      }
      get_top_customers: {
        Args: { p_end: string; p_limit?: number; p_start: string }
        Returns: {
          avg_ticket: number
          customer_id_customer: number
          customer_name: string
          customer_phone: string
          first_order_date: string
          last_order_date: string
          total_orders: number
          total_revenue: number
        }[]
      }
      get_top_products: {
        Args: {
          p_end: string
          p_limit?: number
          p_sale_types?: number[]
          p_start: string
        }
        Returns: {
          channels: string[]
          display_name: string
          normalized_name: string
          orders: number
          quantity: number
          revenue: number
        }[]
      }
      get_waiter_ranking: {
        Args: { p_end: string; p_limit?: number; p_start: string }
        Returns: {
          id_store_waiter: number
          total_items: number
          total_orders: number
          total_revenue: number
        }[]
      }
      list_saipos_crons: {
        Args: never
        Returns: {
          active: boolean
          jobid: number
          jobname: string
          schedule: string
        }[]
      }
      schedule_saipos_crons: {
        Args: { p_auth_key: string; p_functions_url: string }
        Returns: Json
      }
      unschedule_saipos_crons: { Args: never; Returns: Json }
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
