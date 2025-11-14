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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_activity_logs: {
        Row: {
          action_type: string
          admin_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_conversations: {
        Row: {
          agent_id: string | null
          created_at: string
          feedback: string | null
          id: string
          messages: Json | null
          rating: number | null
          session_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          messages?: Json | null
          rating?: number | null
          session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          messages?: Json | null
          rating?: number | null
          session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_openai_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "agent_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_web_research_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "agent_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_documents: {
        Row: {
          agent_id: string
          created_at: string
          document_id: string
          id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          document_id: string
          id?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          document_id?: string
          id?: string
        }
        Relationships: []
      }
      agent_metrics: {
        Row: {
          agent_id: string | null
          avg_response_time_ms: number | null
          created_at: string
          csat_rating: number | null
          date: string
          id: string
          tasks_completed: number | null
          total_conversations: number | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          avg_response_time_ms?: number | null
          created_at?: string
          csat_rating?: number | null
          date?: string
          id?: string
          tasks_completed?: number | null
          total_conversations?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          avg_response_time_ms?: number | null
          created_at?: string
          csat_rating?: number | null
          date?: string
          id?: string
          tasks_completed?: number | null
          total_conversations?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_metrics_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_openai_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "agent_metrics_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_web_research_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "agent_metrics_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tag_assignments: {
        Row: {
          agent_id: string | null
          created_at: string
          id: string
          tag_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          id?: string
          tag_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          id?: string
          tag_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_tag_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_openai_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "agent_tag_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_web_research_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "agent_tag_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "agent_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tags: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "agent_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      agent_tools: {
        Row: {
          agent_id: string
          configuration: Json | null
          created_at: string
          id: string
          is_enabled: boolean
          tool_id: string
        }
        Insert: {
          agent_id: string
          configuration?: Json | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          tool_id: string
        }
        Update: {
          agent_id?: string
          configuration?: Json | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tools_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_openai_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "agent_tools_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_web_research_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "agent_tools_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tools_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_types: {
        Row: {
          created_at: string
          default_avatar_url: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          default_avatar_url?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          default_avatar_url?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      agents: {
        Row: {
          agent_type_id: string | null
          assistant_id: string | null
          avatar_url: string | null
          company_id: string | null
          configuration: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          last_task: string | null
          name: string
          nickname: string | null
          pinecone_index_id: string | null
          role: string
          status: Database["public"]["Enums"]["agent_status"]
          system_instructions: string | null
          updated_at: string
          vector_store_id: string | null
        }
        Insert: {
          agent_type_id?: string | null
          assistant_id?: string | null
          avatar_url?: string | null
          company_id?: string | null
          configuration?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          last_task?: string | null
          name: string
          nickname?: string | null
          pinecone_index_id?: string | null
          role: string
          status?: Database["public"]["Enums"]["agent_status"]
          system_instructions?: string | null
          updated_at?: string
          vector_store_id?: string | null
        }
        Update: {
          agent_type_id?: string | null
          assistant_id?: string | null
          avatar_url?: string | null
          company_id?: string | null
          configuration?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          last_task?: string | null
          name?: string
          nickname?: string | null
          pinecone_index_id?: string | null
          role?: string
          status?: Database["public"]["Enums"]["agent_status"]
          system_instructions?: string | null
          updated_at?: string
          vector_store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_agent_type_id_fkey"
            columns: ["agent_type_id"]
            isOneToOne: false
            referencedRelation: "agent_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "agents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "agents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_agents: {
        Row: {
          added_at: string | null
          added_by: string
          agent_id: string
          channel_id: string
          id: string
        }
        Insert: {
          added_at?: string | null
          added_by: string
          agent_id: string
          channel_id: string
          id?: string
        }
        Update: {
          added_at?: string | null
          added_by?: string
          agent_id?: string
          channel_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_agents_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_private: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_private?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_private?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          agent_id: string
          company_id: string
          created_at: string
          id: string
          openai_thread_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          company_id: string
          created_at?: string
          id?: string
          openai_thread_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          company_id?: string
          created_at?: string
          id?: string
          openai_thread_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          agent_id: string | null
          attachments: Json | null
          channel_id: string | null
          client_message_id: string | null
          content: string
          content_metadata: Json | null
          content_outline: string[] | null
          content_title: string | null
          content_type: string | null
          conversation_id: string | null
          created_at: string
          generation_progress: number | null
          id: string
          is_generating: boolean | null
          mention_type: string | null
          message_type: string | null
          rich_content: Json | null
          role: string
          tool_results: Json | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          attachments?: Json | null
          channel_id?: string | null
          client_message_id?: string | null
          content: string
          content_metadata?: Json | null
          content_outline?: string[] | null
          content_title?: string | null
          content_type?: string | null
          conversation_id?: string | null
          created_at?: string
          generation_progress?: number | null
          id?: string
          is_generating?: boolean | null
          mention_type?: string | null
          message_type?: string | null
          rich_content?: Json | null
          role: string
          tool_results?: Json | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          attachments?: Json | null
          channel_id?: string | null
          client_message_id?: string | null
          content?: string
          content_metadata?: Json | null
          content_outline?: string[] | null
          content_title?: string | null
          content_type?: string | null
          conversation_id?: string | null
          created_at?: string
          generation_progress?: number | null
          id?: string
          is_generating?: boolean | null
          mention_type?: string | null
          message_type?: string | null
          rich_content?: Json | null
          role?: string
          tool_results?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_openai_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "chat_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_web_research_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "chat_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string | null
          domain: string | null
          google_drive_folder_id: string | null
          google_drive_folder_name: string | null
          id: string
          logo_url: string | null
          name: string
          plan: Database["public"]["Enums"]["company_plan"]
          plan_id: string | null
          purchased_seats: number | null
          settings: Json | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_current_period_start: string | null
          subscription_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain?: string | null
          google_drive_folder_id?: string | null
          google_drive_folder_name?: string | null
          id?: string
          logo_url?: string | null
          name: string
          plan?: Database["public"]["Enums"]["company_plan"]
          plan_id?: string | null
          purchased_seats?: number | null
          settings?: Json | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_current_period_start?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain?: string | null
          google_drive_folder_id?: string | null
          google_drive_folder_name?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          plan?: Database["public"]["Enums"]["company_plan"]
          plan_id?: string | null
          purchased_seats?: number | null
          settings?: Json | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_current_period_start?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      company_knowledge_base: {
        Row: {
          analysis_version: number | null
          company_id: string
          company_overview: string | null
          confidence_scores: Json | null
          created_at: string | null
          id: string
          industry_classification: string | null
          key_differentiators: string | null
          metadata: Json | null
          mission_vision: string | null
          products_services: string | null
          source_url: string
          target_market: string | null
          updated_at: string | null
        }
        Insert: {
          analysis_version?: number | null
          company_id: string
          company_overview?: string | null
          confidence_scores?: Json | null
          created_at?: string | null
          id?: string
          industry_classification?: string | null
          key_differentiators?: string | null
          metadata?: Json | null
          mission_vision?: string | null
          products_services?: string | null
          source_url: string
          target_market?: string | null
          updated_at?: string | null
        }
        Update: {
          analysis_version?: number | null
          company_id?: string
          company_overview?: string | null
          confidence_scores?: Json | null
          created_at?: string | null
          id?: string
          industry_classification?: string | null
          key_differentiators?: string | null
          metadata?: Json | null
          mission_vision?: string | null
          products_services?: string | null
          source_url?: string
          target_market?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_os: {
        Row: {
          company_id: string
          confidence_score: number | null
          created_at: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          last_updated: string | null
          metadata: Json | null
          os_data: Json
          source_url: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          company_id: string
          confidence_score?: number | null
          created_at?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          last_updated?: string | null
          metadata?: Json | null
          os_data: Json
          source_url?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          company_id?: string
          confidence_score?: number | null
          created_at?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          last_updated?: string | null
          metadata?: Json | null
          os_data?: Json
          source_url?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_os_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_os_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_os_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_os_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          branding: Json | null
          company_id: string | null
          created_at: string
          id: string
          integrations: Json | null
          knowledge_source: string | null
          onboarding_completed: boolean | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          branding?: Json | null
          company_id?: string | null
          created_at?: string
          id?: string
          integrations?: Json | null
          knowledge_source?: string | null
          onboarding_completed?: boolean | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          branding?: Json | null
          company_id?: string | null
          created_at?: string
          id?: string
          integrations?: Json | null
          knowledge_source?: string | null
          onboarding_completed?: boolean | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      consultation_messages: {
        Row: {
          consultation_request_id: string
          created_at: string
          documents_requested: string[] | null
          id: string
          is_document_request: boolean
          is_note: boolean
          is_private_note: boolean
          message: string
          sender_id: string | null
          sender_name: string
          sender_type: string
        }
        Insert: {
          consultation_request_id: string
          created_at?: string
          documents_requested?: string[] | null
          id?: string
          is_document_request?: boolean
          is_note?: boolean
          is_private_note?: boolean
          message: string
          sender_id?: string | null
          sender_name: string
          sender_type: string
        }
        Update: {
          consultation_request_id?: string
          created_at?: string
          documents_requested?: string[] | null
          id?: string
          is_document_request?: boolean
          is_note?: boolean
          is_private_note?: boolean
          message?: string
          sender_id?: string | null
          sender_name?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_messages_consultation_request_id_fkey"
            columns: ["consultation_request_id"]
            isOneToOne: false
            referencedRelation: "consultation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_requests: {
        Row: {
          additional_notes: string | null
          annual_revenue: string | null
          business_background: string | null
          company_id: string | null
          company_size: string | null
          competitive_landscape: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          current_challenges: string | null
          goals_objectives: string | null
          id: string
          industry: string | null
          preferred_meeting_times: string | null
          status: string
          target_market: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          additional_notes?: string | null
          annual_revenue?: string | null
          business_background?: string | null
          company_id?: string | null
          company_size?: string | null
          competitive_landscape?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          current_challenges?: string | null
          goals_objectives?: string | null
          id?: string
          industry?: string | null
          preferred_meeting_times?: string | null
          status?: string
          target_market?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          additional_notes?: string | null
          annual_revenue?: string | null
          business_background?: string | null
          company_id?: string | null
          company_size?: string | null
          competitive_landscape?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          current_challenges?: string | null
          goals_objectives?: string | null
          id?: string
          industry?: string | null
          preferred_meeting_times?: string | null
          status?: string
          target_market?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "consultation_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "consultation_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      default_agents: {
        Row: {
          agent_type_id: string
          config: Json
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          status: string
        }
        Insert: {
          agent_type_id: string
          config?: Json
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          status?: string
        }
        Update: {
          agent_type_id?: string
          config?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "default_agents_agent_type_id_fkey"
            columns: ["agent_type_id"]
            isOneToOne: false
            referencedRelation: "agent_types"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_logs: {
        Row: {
          action: string
          created_at: string
          document_id: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          document_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          document_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_access_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_archives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_archives: {
        Row: {
          category_id: string | null
          company_id: string | null
          created_at: string
          description: string | null
          doc_type: Database["public"]["Enums"]["document_type"]
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          is_current_version: boolean | null
          is_editable: boolean | null
          name: string
          playbook_section_id: string | null
          storage_path: string
          tags: string[] | null
          updated_at: string
          uploaded_by: string | null
          version_number: number | null
        }
        Insert: {
          category_id?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          doc_type?: Database["public"]["Enums"]["document_type"]
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_current_version?: boolean | null
          is_editable?: boolean | null
          name: string
          playbook_section_id?: string | null
          storage_path: string
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
          version_number?: number | null
        }
        Update: {
          category_id?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          doc_type?: Database["public"]["Enums"]["document_type"]
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_current_version?: boolean | null
          is_editable?: boolean | null
          name?: string
          playbook_section_id?: string | null
          storage_path?: string
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_archives_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_archives_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "document_archives_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_archives_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "document_archives_playbook_section_id_fkey"
            columns: ["playbook_section_id"]
            isOneToOne: false
            referencedRelation: "playbook_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_archives_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_categories: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "document_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      document_versions: {
        Row: {
          changelog: string | null
          created_at: string
          document_id: string | null
          file_name: string
          file_size: number | null
          id: string
          storage_path: string
          uploaded_by: string | null
          version_number: number
        }
        Insert: {
          changelog?: string | null
          created_at?: string
          document_id?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          storage_path: string
          uploaded_by?: string | null
          version_number: number
        }
        Update: {
          changelog?: string | null
          created_at?: string
          document_id?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          storage_path?: string
          uploaded_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_archives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          agent_id: string | null
          company_id: string
          content: string
          created_at: string | null
          document_archive_id: string | null
          embedding: string | null
          id: number
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          company_id: string
          content: string
          created_at?: string | null
          document_archive_id?: string | null
          embedding?: string | null
          id?: number
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          company_id?: string
          content?: string
          created_at?: string | null
          document_archive_id?: string | null
          embedding?: string | null
          id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_openai_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_web_research_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "documents_document_archive_id_fkey"
            columns: ["document_archive_id"]
            isOneToOne: false
            referencedRelation: "document_archives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_documents_agent_id"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_openai_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "fk_documents_agent_id"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_web_research_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "fk_documents_agent_id"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_messages: {
        Row: {
          company_id: string
          created_at: string
          gmail_message_id: string
          has_attachments: boolean
          id: string
          is_important: boolean
          is_read: boolean
          labels: string[] | null
          message_content: string | null
          received_at: string | null
          recipient_emails: string[] | null
          sender_email: string | null
          sender_name: string | null
          snippet: string | null
          subject: string | null
          synced_at: string
          thread_id: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          gmail_message_id: string
          has_attachments?: boolean
          id?: string
          is_important?: boolean
          is_read?: boolean
          labels?: string[] | null
          message_content?: string | null
          received_at?: string | null
          recipient_emails?: string[] | null
          sender_email?: string | null
          sender_name?: string | null
          snippet?: string | null
          subject?: string | null
          synced_at?: string
          thread_id?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          gmail_message_id?: string
          has_attachments?: boolean
          id?: string
          is_important?: boolean
          is_read?: boolean
          labels?: string[] | null
          message_content?: string | null
          received_at?: string | null
          recipient_emails?: string[] | null
          sender_email?: string | null
          sender_name?: string | null
          snippet?: string | null
          subject?: string | null
          synced_at?: string
          thread_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      google_api_logs: {
        Row: {
          api_service: string
          company_id: string
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          method: string
          quota_used: number | null
          rate_limit_remaining: number | null
          response_time_ms: number | null
          status_code: number | null
          user_id: string
        }
        Insert: {
          api_service: string
          company_id: string
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          method: string
          quota_used?: number | null
          rate_limit_remaining?: number | null
          response_time_ms?: number | null
          status_code?: number | null
          user_id: string
        }
        Update: {
          api_service?: string
          company_id?: string
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          method?: string
          quota_used?: number | null
          rate_limit_remaining?: number | null
          response_time_ms?: number | null
          status_code?: number | null
          user_id?: string
        }
        Relationships: []
      }
      google_drive_files: {
        Row: {
          company_id: string
          content: string | null
          created_at: string
          created_time: string | null
          download_link: string | null
          drive_file_id: string
          file_size: number | null
          folder_path: string | null
          id: string
          is_shared: boolean
          mime_type: string | null
          modified_time: string | null
          name: string
          parent_folder_id: string | null
          permissions: Json | null
          synced_at: string
          user_id: string
          web_view_link: string | null
        }
        Insert: {
          company_id: string
          content?: string | null
          created_at?: string
          created_time?: string | null
          download_link?: string | null
          drive_file_id: string
          file_size?: number | null
          folder_path?: string | null
          id?: string
          is_shared?: boolean
          mime_type?: string | null
          modified_time?: string | null
          name: string
          parent_folder_id?: string | null
          permissions?: Json | null
          synced_at?: string
          user_id: string
          web_view_link?: string | null
        }
        Update: {
          company_id?: string
          content?: string | null
          created_at?: string
          created_time?: string | null
          download_link?: string | null
          drive_file_id?: string
          file_size?: number | null
          folder_path?: string | null
          id?: string
          is_shared?: boolean
          mime_type?: string | null
          modified_time?: string | null
          name?: string
          parent_folder_id?: string | null
          permissions?: Json | null
          synced_at?: string
          user_id?: string
          web_view_link?: string | null
        }
        Relationships: []
      }
      google_integrations: {
        Row: {
          access_token: string | null
          calendar_enabled: boolean
          company_id: string
          created_at: string
          docs_enabled: boolean
          drive_enabled: boolean
          gmail_enabled: boolean
          id: string
          is_active: boolean
          refresh_token: string | null
          scopes: string[]
          sheets_enabled: boolean
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          calendar_enabled?: boolean
          company_id: string
          created_at?: string
          docs_enabled?: boolean
          drive_enabled?: boolean
          gmail_enabled?: boolean
          id?: string
          is_active?: boolean
          refresh_token?: string | null
          scopes?: string[]
          sheets_enabled?: boolean
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          calendar_enabled?: boolean
          company_id?: string
          created_at?: string
          docs_enabled?: boolean
          drive_enabled?: boolean
          gmail_enabled?: boolean
          id?: string
          is_active?: boolean
          refresh_token?: string | null
          scopes?: string[]
          sheets_enabled?: boolean
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_sheets_data: {
        Row: {
          company_id: string
          created_at: string
          data_values: Json
          id: string
          last_modified: string | null
          range_notation: string | null
          sheet_name: string
          spreadsheet_id: string
          synced_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          data_values?: Json
          id?: string
          last_modified?: string | null
          range_notation?: string | null
          sheet_name: string
          spreadsheet_id: string
          synced_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          data_values?: Json
          id?: string
          last_modified?: string | null
          range_notation?: string | null
          sheet_name?: string
          spreadsheet_id?: string
          synced_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hubspot_api_logs: {
        Row: {
          api_service: string
          company_id: string
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          method: string
          quota_used: number | null
          rate_limit_remaining: number | null
          response_time_ms: number | null
          status_code: number | null
          user_id: string
        }
        Insert: {
          api_service: string
          company_id: string
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          method: string
          quota_used?: number | null
          rate_limit_remaining?: number | null
          response_time_ms?: number | null
          status_code?: number | null
          user_id: string
        }
        Update: {
          api_service?: string
          company_id?: string
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          method?: string
          quota_used?: number | null
          rate_limit_remaining?: number | null
          response_time_ms?: number | null
          status_code?: number | null
          user_id?: string
        }
        Relationships: []
      }
      hubspot_companies: {
        Row: {
          city: string | null
          company_id: string
          country: string | null
          created_at: string | null
          domain: string | null
          hubspot_company_id: string
          id: string
          industry: string | null
          name: string | null
          phone: string | null
          properties: Json | null
          state: string | null
          synced_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          company_id: string
          country?: string | null
          created_at?: string | null
          domain?: string | null
          hubspot_company_id: string
          id?: string
          industry?: string | null
          name?: string | null
          phone?: string | null
          properties?: Json | null
          state?: string | null
          synced_at?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          company_id?: string
          country?: string | null
          created_at?: string | null
          domain?: string | null
          hubspot_company_id?: string
          id?: string
          industry?: string | null
          name?: string | null
          phone?: string | null
          properties?: Json | null
          state?: string | null
          synced_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      hubspot_contacts: {
        Row: {
          company_id: string
          company_name: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          hubspot_contact_id: string
          id: string
          job_title: string | null
          last_name: string | null
          lead_status: string | null
          lifecycle_stage: string | null
          phone: string | null
          properties: Json | null
          synced_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          hubspot_contact_id: string
          id?: string
          job_title?: string | null
          last_name?: string | null
          lead_status?: string | null
          lifecycle_stage?: string | null
          phone?: string | null
          properties?: Json | null
          synced_at?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          hubspot_contact_id?: string
          id?: string
          job_title?: string | null
          last_name?: string | null
          lead_status?: string | null
          lifecycle_stage?: string | null
          phone?: string | null
          properties?: Json | null
          synced_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      hubspot_deals: {
        Row: {
          amount: number | null
          close_date: string | null
          company_id: string
          created_at: string | null
          currency: string | null
          deal_name: string | null
          deal_stage: string | null
          deal_type: string | null
          hubspot_deal_id: string
          id: string
          properties: Json | null
          synced_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          close_date?: string | null
          company_id: string
          created_at?: string | null
          currency?: string | null
          deal_name?: string | null
          deal_stage?: string | null
          deal_type?: string | null
          hubspot_deal_id: string
          id?: string
          properties?: Json | null
          synced_at?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          close_date?: string | null
          company_id?: string
          created_at?: string | null
          currency?: string | null
          deal_name?: string | null
          deal_stage?: string | null
          deal_type?: string | null
          hubspot_deal_id?: string
          id?: string
          properties?: Json | null
          synced_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      hubspot_integrations: {
        Row: {
          access_token: string | null
          companies_enabled: boolean
          company_id: string
          contacts_enabled: boolean
          created_at: string
          deals_enabled: boolean
          id: string
          is_active: boolean
          refresh_token: string | null
          scopes: string[]
          tickets_enabled: boolean
          token_expires_at: string | null
          updated_at: string
          user_id: string
          workflows_enabled: boolean
        }
        Insert: {
          access_token?: string | null
          companies_enabled?: boolean
          company_id: string
          contacts_enabled?: boolean
          created_at?: string
          deals_enabled?: boolean
          id?: string
          is_active?: boolean
          refresh_token?: string | null
          scopes?: string[]
          tickets_enabled?: boolean
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
          workflows_enabled?: boolean
        }
        Update: {
          access_token?: string | null
          companies_enabled?: boolean
          company_id?: string
          contacts_enabled?: boolean
          created_at?: string
          deals_enabled?: boolean
          id?: string
          is_active?: boolean
          refresh_token?: string | null
          scopes?: string[]
          tickets_enabled?: boolean
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
          workflows_enabled?: boolean
        }
        Relationships: []
      }
      kpi_metrics: {
        Row: {
          change_percentage: number | null
          company_id: string | null
          created_at: string
          id: string
          metric_name: string
          metric_value: number
          period_end: string
          period_start: string
        }
        Insert: {
          change_percentage?: number | null
          company_id?: string | null
          created_at?: string
          id?: string
          metric_name: string
          metric_value: number
          period_end: string
          period_start: string
        }
        Update: {
          change_percentage?: number | null
          company_id?: string | null
          created_at?: string
          id?: string
          metric_name?: string
          metric_value?: number
          period_end?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "kpi_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      message_mentions: {
        Row: {
          created_at: string | null
          id: string
          mention_position: number
          mentioned_by: string
          mentioned_user_id: string
          message_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mention_position: number
          mentioned_by: string
          mentioned_user_id: string
          message_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mention_position?: number
          mentioned_by?: string
          mentioned_user_id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_mentions_mentioned_by_fkey"
            columns: ["mentioned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          id: string
          notification_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          notification_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          notification_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          agent_id: string | null
          channel_id: string | null
          created_at: string | null
          created_by: string | null
          data: Json | null
          id: string
          message: string
          message_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          channel_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: Json | null
          id?: string
          message: string
          message_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string | null
          channel_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: Json | null
          id?: string
          message?: string
          message_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_openai_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "notifications_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_web_research_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "notifications_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
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
      onboarding_sessions: {
        Row: {
          company_id: string | null
          completed_at: string | null
          completed_steps: number[] | null
          consultation_status: string | null
          created_at: string
          current_step: number | null
          documents_uploaded: Json | null
          id: string
          knowledge_base_content: Json | null
          meeting_scheduled_at: string | null
          onboarding_type: string | null
          progress_percentage: number | null
          session_data: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["onboarding_status"]
          updated_at: string
          user_id: string | null
          website_url: string | null
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          completed_steps?: number[] | null
          consultation_status?: string | null
          created_at?: string
          current_step?: number | null
          documents_uploaded?: Json | null
          id?: string
          knowledge_base_content?: Json | null
          meeting_scheduled_at?: string | null
          onboarding_type?: string | null
          progress_percentage?: number | null
          session_data?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["onboarding_status"]
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          completed_steps?: number[] | null
          consultation_status?: string | null
          created_at?: string
          current_step?: number | null
          documents_uploaded?: Json | null
          id?: string
          knowledge_base_content?: Json | null
          meeting_scheduled_at?: string | null
          onboarding_type?: string | null
          progress_percentage?: number | null
          session_data?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["onboarding_status"]
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "onboarding_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "onboarding_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_steps: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean | null
          step_number: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean | null
          step_number: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean | null
          step_number?: number
          title?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: []
      }
      playbook_activity: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          details: string | null
          id: string
          section_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          section_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          section_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playbook_activity_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "playbook_activity_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_activity_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "playbook_activity_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "playbook_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_documents: {
        Row: {
          company_id: string | null
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          section_id: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          section_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          section_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playbook_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "playbook_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "playbook_documents_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "playbook_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_section_versions: {
        Row: {
          change_summary: string | null
          changed_by: string | null
          company_id: string | null
          content: string | null
          created_at: string | null
          id: string
          progress_percentage: number | null
          section_id: string | null
          status: Database["public"]["Enums"]["playbook_status"]
          tags: string[] | null
          title: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          changed_by?: string | null
          company_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          progress_percentage?: number | null
          section_id?: string | null
          status?: Database["public"]["Enums"]["playbook_status"]
          tags?: string[] | null
          title: string
          version_number: number
        }
        Update: {
          change_summary?: string | null
          changed_by?: string | null
          company_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          progress_percentage?: number | null
          section_id?: string | null
          status?: Database["public"]["Enums"]["playbook_status"]
          tags?: string[] | null
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "playbook_section_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_section_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "playbook_section_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_section_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "playbook_section_versions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "playbook_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_sections: {
        Row: {
          company_id: string | null
          content: string | null
          created_at: string
          estimated_read_time: number | null
          id: string
          last_updated_by: string | null
          progress_percentage: number | null
          section_order: number | null
          status: Database["public"]["Enums"]["playbook_status"]
          tags: string[] | null
          title: string
          updated_at: string
          word_count: number | null
        }
        Insert: {
          company_id?: string | null
          content?: string | null
          created_at?: string
          estimated_read_time?: number | null
          id?: string
          last_updated_by?: string | null
          progress_percentage?: number | null
          section_order?: number | null
          status?: Database["public"]["Enums"]["playbook_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          company_id?: string | null
          content?: string | null
          created_at?: string
          estimated_read_time?: number | null
          id?: string
          last_updated_by?: string | null
          progress_percentage?: number | null
          section_order?: number | null
          status?: Database["public"]["Enums"]["playbook_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "playbook_sections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "playbook_sections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_sections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "playbook_sections_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_login_at: string | null
          last_name: string | null
          role: Database["public"]["Enums"]["app_role"]
          settings: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_login_at?: string | null
          last_name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_login_at?: string | null
          last_name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          settings?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      quickbooks_integrations: {
        Row: {
          access_token: string
          accounts_enabled: boolean | null
          company_id: string | null
          created_at: string | null
          customers_enabled: boolean | null
          id: string
          invoices_enabled: boolean | null
          is_active: boolean | null
          items_enabled: boolean | null
          payments_enabled: boolean | null
          realm_id: string | null
          refresh_token: string
          refresh_token_expires_at: string
          scopes: string[] | null
          token_expires_at: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token: string
          accounts_enabled?: boolean | null
          company_id?: string | null
          created_at?: string | null
          customers_enabled?: boolean | null
          id?: string
          invoices_enabled?: boolean | null
          is_active?: boolean | null
          items_enabled?: boolean | null
          payments_enabled?: boolean | null
          realm_id?: string | null
          refresh_token: string
          refresh_token_expires_at: string
          scopes?: string[] | null
          token_expires_at: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string
          accounts_enabled?: boolean | null
          company_id?: string | null
          created_at?: string | null
          customers_enabled?: boolean | null
          id?: string
          invoices_enabled?: boolean | null
          is_active?: boolean | null
          items_enabled?: boolean | null
          payments_enabled?: boolean | null
          realm_id?: string | null
          refresh_token?: string
          refresh_token_expires_at?: string
          scopes?: string[] | null
          token_expires_at?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "quickbooks_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quickbooks_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "quickbooks_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rich_text_documents: {
        Row: {
          content_type: string
          created_at: string
          id: string
          is_current_version: boolean | null
          message_id: string
          rich_content: Json
          title: string
          updated_at: string
          version: number | null
        }
        Insert: {
          content_type: string
          created_at?: string
          id?: string
          is_current_version?: boolean | null
          message_id: string
          rich_content: Json
          title: string
          updated_at?: string
          version?: number | null
        }
        Update: {
          content_type?: string
          created_at?: string
          id?: string
          is_current_version?: boolean | null
          message_id?: string
          rich_content?: Json
          title?: string
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rich_text_documents_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_integrations: {
        Row: {
          access_token: string
          analytics_enabled: boolean | null
          associated_user: Json | null
          checkouts_enabled: boolean | null
          company_id: string | null
          content_enabled: boolean | null
          created_at: string | null
          customers_enabled: boolean | null
          discounts_enabled: boolean | null
          fulfillments_enabled: boolean | null
          id: string
          inventory_enabled: boolean | null
          is_active: boolean | null
          orders_enabled: boolean | null
          products_enabled: boolean | null
          reports_enabled: boolean | null
          scopes: string[] | null
          shipping_enabled: boolean | null
          shop_domain: string
          themes_enabled: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token: string
          analytics_enabled?: boolean | null
          associated_user?: Json | null
          checkouts_enabled?: boolean | null
          company_id?: string | null
          content_enabled?: boolean | null
          created_at?: string | null
          customers_enabled?: boolean | null
          discounts_enabled?: boolean | null
          fulfillments_enabled?: boolean | null
          id?: string
          inventory_enabled?: boolean | null
          is_active?: boolean | null
          orders_enabled?: boolean | null
          products_enabled?: boolean | null
          reports_enabled?: boolean | null
          scopes?: string[] | null
          shipping_enabled?: boolean | null
          shop_domain: string
          themes_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string
          analytics_enabled?: boolean | null
          associated_user?: Json | null
          checkouts_enabled?: boolean | null
          company_id?: string | null
          content_enabled?: boolean | null
          created_at?: string | null
          customers_enabled?: boolean | null
          discounts_enabled?: boolean | null
          fulfillments_enabled?: boolean | null
          id?: string
          inventory_enabled?: boolean | null
          is_active?: boolean | null
          orders_enabled?: boolean | null
          products_enabled?: boolean | null
          reports_enabled?: boolean | null
          scopes?: string[] | null
          shipping_enabled?: boolean | null
          shop_domain?: string
          themes_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "shopify_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          message_limit_per_seat: number
          name: string
          price_monthly: number
          seat_limit: number | null
          slug: string
          stripe_price_id: string
          stripe_product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          message_limit_per_seat: number
          name: string
          price_monthly: number
          seat_limit?: number | null
          slug: string
          stripe_price_id: string
          stripe_product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          message_limit_per_seat?: number
          name?: string
          price_monthly?: number
          seat_limit?: number | null
          slug?: string
          stripe_price_id?: string
          stripe_product_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          first_name: string
          id: string
          invitation_token: string
          invited_by: string
          last_name: string
          metadata: Json | null
          personal_message: string | null
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          first_name: string
          id?: string
          invitation_token: string
          invited_by: string
          last_name: string
          metadata?: Json | null
          personal_message?: string | null
          role?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string
          id?: string
          invitation_token?: string
          invited_by?: string
          last_name?: string
          metadata?: Json | null
          personal_message?: string | null
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "team_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "team_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tools: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          name: string
          schema_definition: Json
          tool_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          name: string
          schema_definition?: Json
          tool_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          name?: string
          schema_definition?: Json
          tool_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      usage_analytics: {
        Row: {
          company_id: string | null
          created_at: string
          event_data: Json | null
          event_name: string
          id: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          event_data?: Json | null
          event_name: string
          id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          event_data?: Json | null
          event_name?: string
          id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_analytics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "usage_analytics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_analytics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "usage_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_history: {
        Row: {
          archived_at: string
          company_id: string
          id: string
          messages_limit: number
          messages_used: number
          period_end: string
          period_start: string
          user_id: string
        }
        Insert: {
          archived_at?: string
          company_id: string
          id?: string
          messages_limit: number
          messages_used: number
          period_end: string
          period_start: string
          user_id: string
        }
        Update: {
          archived_at?: string
          company_id?: string
          id?: string
          messages_limit?: number
          messages_used?: number
          period_end?: string
          period_start?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "usage_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      user_activities: {
        Row: {
          activity_category: string
          activity_type: string
          agent_id: string | null
          company_id: string | null
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          status: string | null
          tags: string[] | null
          target_resource_id: string | null
          target_resource_type: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          activity_category: string
          activity_type: string
          agent_id?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          tags?: string[] | null
          target_resource_id?: string | null
          target_resource_type?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          activity_category?: string
          activity_type?: string
          agent_id?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          tags?: string[] | null
          target_resource_id?: string | null
          target_resource_type?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_activities_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_openai_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "user_activities_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_web_research_status"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "user_activities_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "user_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      user_companies: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "user_companies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_settings: {
        Row: {
          created_at: string | null
          email_enabled: boolean | null
          enabled: boolean | null
          id: string
          notification_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_enabled?: boolean | null
          enabled?: boolean | null
          id?: string
          notification_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_enabled?: boolean | null
          enabled?: boolean | null
          id?: string
          notification_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          channel_id: string | null
          conversation_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_seen: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_seen?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_seen?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_presence_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_presence_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_usage: {
        Row: {
          company_id: string
          created_at: string
          id: string
          messages_limit: number
          messages_used: number
          period_end: string
          period_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          messages_limit: number
          messages_used?: number
          period_end: string
          period_start: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          messages_limit?: number
          messages_used?: number
          period_end?: string
          period_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "user_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
    }
    Views: {
      admin_kpi_summary: {
        Row: {
          active_agents: number | null
          active_users: number | null
          company_id: string | null
          company_name: string | null
          completed_onboarding: number | null
          completed_sections: number | null
          created_at: string | null
          onboarding_completion_rate: number | null
          onboarding_sessions: number | null
          plan: Database["public"]["Enums"]["company_plan"] | null
          playbook_completion_rate: number | null
          playbook_sections: number | null
          total_agents: number | null
          total_users: number | null
          user_activity_rate: number | null
        }
        Relationships: []
      }
      agent_openai_status: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          assistant_id: string | null
          company_id: string | null
          company_name: string | null
          created_at: string | null
          openai_status: string | null
          status: Database["public"]["Enums"]["agent_status"] | null
          updated_at: string | null
          vector_store_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_kpi_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "agents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_seat_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      agent_web_research_status: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          agent_status: Database["public"]["Enums"]["agent_status"] | null
          company_name: string | null
          tool_configuration: Json | null
          web_research_status: string | null
        }
        Relationships: []
      }
      company_seat_usage: {
        Row: {
          active_users: number | null
          available_seats: number | null
          company_id: string | null
          company_name: string | null
          purchased_seats: number | null
          usage_percentage: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      bytea_to_text: {
        Args: { data: string }
        Returns: string
      }
      copy_default_agent_to_company: {
        Args: { p_company_id: string; p_default_agent_id: string }
        Returns: string
      }
      create_company_and_link_profile: {
        Args: { p_company_name: string; p_user_id: string }
        Returns: {
          company_id: string
          company_name: string
        }[]
      }
      create_company_for_signup: {
        Args: { company_name: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      create_default_playbook_sections: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      expire_old_invitations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_agents_needing_openai_config: {
        Args: Record<PropertyKey, never>
        Returns: {
          agent_id: string
          agent_name: string
          company_id: string
          company_name: string
          missing_assistant_id: boolean
          missing_vector_store_id: boolean
        }[]
      }
      get_company_active_users: {
        Args: { p_company_id: string }
        Returns: number
      }
      get_company_usage_stats: {
        Args: { p_company_id: string }
        Returns: {
          last_message_at: string
          messages_limit: number
          messages_used: number
          usage_percentage: number
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_unread_notification_count: {
        Args: { user_uuid: string }
        Returns: number
      }
      get_user_company_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_current_usage: {
        Args: { p_user_id: string }
        Returns: {
          messages_limit: number
          messages_remaining: number
          messages_used: number
          period_end: string
          period_start: string
          usage_percentage: number
        }[]
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      has_available_seats: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_delete: {
        Args:
          | { content: string; content_type: string; uri: string }
          | { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_get: {
        Args: { data: Json; uri: string } | { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
      }
      http_list_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_post: {
        Args:
          | { content: string; content_type: string; uri: string }
          | { data: Json; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_reset_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      initialize_user_notification_settings: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      initialize_user_usage: {
        Args: {
          p_company_id: string
          p_message_limit: number
          p_period_end?: string
          p_period_start?: string
          p_user_id: string
        }
        Returns: string
      }
      is_company_admin: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: {
        Args: Record<PropertyKey, never> | { _user_id: string }
        Returns: boolean
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      log_admin_activity: {
        Args: {
          p_action_type: string
          p_details?: Json
          p_resource_id?: string
          p_resource_type: string
        }
        Returns: string
      }
      mark_notification_read: {
        Args: { notification_uuid: string; user_uuid: string }
        Returns: undefined
      }
      mark_user_away: {
        Args: {
          p_channel_id?: string
          p_conversation_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
      match_documents: {
        Args: {
          match_count: number
          match_threshold: number
          p_agent_id?: string
          p_company_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          document_archive_id: string
          file_name: string
          id: number
          similarity: number
        }[]
      }
      provision_agent_openai_resources: {
        Args: {
          p_agent_description?: string
          p_agent_id: string
          p_agent_name: string
          p_company_id: string
        }
        Returns: Json
      }
      reset_monthly_usage: {
        Args: { p_company_id: string }
        Returns: {
          records_archived: number
          users_reset: number
        }[]
      }
      seed_default_agent_to_all_companies: {
        Args: { p_default_agent_id: string }
        Returns: number
      }
      seed_default_agents_for_company: {
        Args: { p_company_id: string }
        Returns: number
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      text_to_bytea: {
        Args: { data: string }
        Returns: string
      }
      update_user_presence: {
        Args: {
          p_channel_id?: string
          p_conversation_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
      urlencode: {
        Args: { data: Json } | { string: string } | { string: string }
        Returns: string
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      agent_status: "active" | "training" | "inactive" | "paused"
      agent_type:
        | "sales"
        | "support"
        | "operations"
        | "hr"
        | "marketing"
        | "custom"
      app_role: "admin" | "moderator" | "user" | "platform-admin"
      company_plan: "basic" | "professional" | "enterprise"
      document_type:
        | "sop"
        | "contract"
        | "manual"
        | "policy"
        | "template"
        | "other"
      notification_type:
        | "mention"
        | "channel_message"
        | "channel_created"
        | "channel_updated"
        | "agent_response"
        | "document_shared"
        | "playbook_updated"
        | "system_alert"
        | "member_added"
        | "member_removed"
        | "integration_connected"
        | "integration_error"
        | "webhook_received"
      onboarding_status: "not_started" | "in_progress" | "completed"
      playbook_status: "draft" | "in_progress" | "complete"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown | null
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
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
      agent_status: ["active", "training", "inactive", "paused"],
      agent_type: [
        "sales",
        "support",
        "operations",
        "hr",
        "marketing",
        "custom",
      ],
      app_role: ["admin", "moderator", "user", "platform-admin"],
      company_plan: ["basic", "professional", "enterprise"],
      document_type: [
        "sop",
        "contract",
        "manual",
        "policy",
        "template",
        "other",
      ],
      notification_type: [
        "mention",
        "channel_message",
        "channel_created",
        "channel_updated",
        "agent_response",
        "document_shared",
        "playbook_updated",
        "system_alert",
        "member_added",
        "member_removed",
        "integration_connected",
        "integration_error",
        "webhook_received",
      ],
      onboarding_status: ["not_started", "in_progress", "completed"],
      playbook_status: ["draft", "in_progress", "complete"],
    },
  },
} as const
