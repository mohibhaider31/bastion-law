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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          agenda: string | null
          client_id: string
          confirmed_at: string | null
          created_at: string
          duration_minutes: number
          id: string
          lawyer_id: string
          location: string | null
          matter_id: string | null
          proposed_at: string
          proposed_by: string | null
          status: string
          type: string
          updated_at: string
          video_room_url: string | null
        }
        Insert: {
          agenda?: string | null
          client_id: string
          confirmed_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          lawyer_id: string
          location?: string | null
          matter_id?: string | null
          proposed_at: string
          proposed_by?: string | null
          status?: string
          type?: string
          updated_at?: string
          video_room_url?: string | null
        }
        Update: {
          agenda?: string | null
          client_id?: string
          confirmed_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          lawyer_id?: string
          location?: string | null
          matter_id?: string | null
          proposed_at?: string
          proposed_by?: string | null
          status?: string
          type?: string
          updated_at?: string
          video_room_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          id: string
          matter_id: string | null
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          id?: string
          matter_id?: string | null
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          matter_id?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          added_by: string | null
          created_at: string
          email: string | null
          firm: string | null
          id: string
          matter_id: string
          name: string
          notes: string | null
          phone: string | null
          role: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email?: string | null
          firm?: string | null
          id?: string
          matter_id: string
          name: string
          notes?: string | null
          phone?: string | null
          role: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string | null
          firm?: string | null
          id?: string
          matter_id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          created_at: string
          due_date: string | null
          file_name: string | null
          file_size_kb: number | null
          file_url: string | null
          id: string
          matter_id: string
          name: string
          requested_by: string | null
          requires_esign: boolean
          signed_at: string | null
          signed_by: string | null
          signed_name: string | null
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          due_date?: string | null
          file_name?: string | null
          file_size_kb?: number | null
          file_url?: string | null
          id?: string
          matter_id: string
          name: string
          requested_by?: string | null
          requires_esign?: boolean
          signed_at?: string | null
          signed_by?: string | null
          signed_name?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          due_date?: string | null
          file_name?: string | null
          file_size_kb?: number | null
          file_url?: string | null
          id?: string
          matter_id?: string
          name?: string
          requested_by?: string | null
          requires_esign?: boolean
          signed_at?: string | null
          signed_by?: string | null
          signed_name?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          cause_no: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          event_date: string
          event_time: string | null
          id: string
          location: string | null
          matter_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          cause_no?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          event_date: string
          event_time?: string | null
          id?: string
          location?: string | null
          matter_id: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          cause_no?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          event_date?: string
          event_time?: string | null
          id?: string
          location?: string | null
          matter_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_pkr: number
          billable: boolean
          category: string
          created_at: string
          description: string
          expense_date: string
          id: string
          logged_by: string | null
          matter_id: string
          receipt_url: string | null
        }
        Insert: {
          amount_pkr: number
          billable?: boolean
          category: string
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          logged_by?: string | null
          matter_id: string
          receipt_url?: string | null
        }
        Update: {
          amount_pkr?: number
          billable?: boolean
          category?: string
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          logged_by?: string | null
          matter_id?: string
          receipt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          unit_paisas: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          unit_paisas: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          unit_paisas?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paisas: number
          client_id: string
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          invoice_ref: string
          matter_id: string | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_paisas: number
          client_id: string
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          invoice_ref: string
          matter_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_paisas?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          invoice_ref?: string
          matter_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      matter_lawyers: {
        Row: {
          added_at: string
          lawyer_id: string
          matter_id: string
          role: string
        }
        Insert: {
          added_at?: string
          lawyer_id: string
          matter_id: string
          role?: string
        }
        Update: {
          added_at?: string
          lawyer_id?: string
          matter_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "matter_lawyers_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matter_lawyers_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      matters: {
        Row: {
          cause_no: string | null
          client_id: string
          closed_at: string | null
          confidentiality: string
          court: string | null
          created_at: string
          description: string | null
          id: string
          lead_lawyer_id: string
          matter_ref: string
          opened_at: string
          stage: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          cause_no?: string | null
          client_id: string
          closed_at?: string | null
          confidentiality?: string
          court?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_lawyer_id: string
          matter_ref: string
          opened_at?: string
          stage?: string
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          cause_no?: string | null
          client_id?: string
          closed_at?: string | null
          confidentiality?: string
          court?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_lawyer_id?: string
          matter_ref?: string
          opened_at?: string
          stage?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matters_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matters_lead_lawyer_id_fkey"
            columns: ["lead_lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_size_kb: number | null
          attachment_type: string | null
          attachment_url: string | null
          body: string
          client_id: string | null
          created_at: string
          id: string
          is_system: boolean
          matter_id: string | null
          read_at: string | null
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_size_kb?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          body: string
          client_id?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          matter_id?: string | null
          read_at?: string | null
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_size_kb?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string
          client_id?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          matter_id?: string | null
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          matter_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          matter_id?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          matter_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      private_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          matter_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          matter_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          matter_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_notes_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cnic: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          cnic?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          cnic?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_configs: {
        Row: {
          created_at: string
          escalation_hours: number
          escalation_target_id: string | null
          id: string
          response_hours: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          escalation_hours?: number
          escalation_target_id?: string | null
          id?: string
          response_hours?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          escalation_hours?: number
          escalation_target_id?: string | null
          id?: string
          response_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_configs_escalation_target_id_fkey"
            columns: ["escalation_target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string
          client_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          matter_id: string | null
          priority: string
          related_document_id: string | null
          related_invoice_id: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string
          client_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          matter_id?: string | null
          priority?: string
          related_document_id?: string | null
          related_invoice_id?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          client_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          matter_id?: string | null
          priority?: string
          related_document_id?: string | null
          related_invoice_id?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_document_id_fkey"
            columns: ["related_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_invoice_id_fkey"
            columns: ["related_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          billable: boolean
          created_at: string
          description: string
          entry_date: string
          hours: number
          id: string
          lawyer_id: string
          matter_id: string
        }
        Insert: {
          billable?: boolean
          created_at?: string
          description: string
          entry_date: string
          hours: number
          id?: string
          lawyer_id: string
          matter_id: string
        }
        Update: {
          billable?: boolean
          created_at?: string
          description?: string
          entry_date?: string
          hours?: number
          id?: string
          lawyer_id?: string
          matter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: { Args: never; Returns: string }
      dispatch_due_reminders: { Args: never; Returns: undefined }
      generate_video_room: {
        Args: { p_appointment_id: string }
        Returns: string
      }
      lawyer_on_matter: {
        Args: { p_lawyer_id: string; p_matter_id: string }
        Returns: boolean
      }
      search_matter_content: {
        Args: { p_query: string; p_role: string; p_user_id: string }
        Returns: {
          created_at: string
          id: string
          matter_id: string
          matter_ref: string
          result_type: string
          snippet: string
          title: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
