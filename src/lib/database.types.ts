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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      achievement_milestones: {
        Row: {
          achieved_value: number | null
          celebrated: boolean
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          milestone_type: string
          title: string
          user_id: string
        }
        Insert: {
          achieved_value?: number | null
          celebrated?: boolean
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          milestone_type: string
          title: string
          user_id: string
        }
        Update: {
          achieved_value?: number | null
          celebrated?: boolean
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          milestone_type?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievement_milestones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievement_milestones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "achievement_milestones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "achievement_milestones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievement_milestones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      ai_summaries: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          model: string | null
          next_action: string | null
          period_start: string
          period_type: string
          prompt_version: string | null
          source: string
          summary: string | null
          summary_short: string | null
          themes: Json
          updated_at: string
          user_id: string
          wins: Json
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          model?: string | null
          next_action?: string | null
          period_start: string
          period_type: string
          prompt_version?: string | null
          source?: string
          summary?: string | null
          summary_short?: string | null
          themes?: Json
          updated_at?: string
          user_id: string
          wins?: Json
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          model?: string | null
          next_action?: string | null
          period_start?: string
          period_type?: string
          prompt_version?: string | null
          source?: string
          summary?: string | null
          summary_short?: string | null
          themes?: Json
          updated_at?: string
          user_id?: string
          wins?: Json
        }
        Relationships: []
      }
      athlete_transfer_requests: {
        Row: {
          athlete_id: string
          completed_at: string | null
          created_at: string | null
          from_team_id: string
          id: string
          organization_id: string
          request_reason: string | null
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          to_team_id: string
          updated_at: string | null
        }
        Insert: {
          athlete_id: string
          completed_at?: string | null
          created_at?: string | null
          from_team_id: string
          id?: string
          organization_id: string
          request_reason?: string | null
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: string
          to_team_id: string
          updated_at?: string | null
        }
        Update: {
          athlete_id?: string
          completed_at?: string | null
          created_at?: string | null
          from_team_id?: string
          id?: string
          organization_id?: string
          request_reason?: string | null
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          to_team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_transfer_requests_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_from_team_id_fkey"
            columns: ["from_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "athlete_transfer_requests_to_team_id_fkey"
            columns: ["to_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          category: string
          code: string | null
          created_at: string
          criteria: Json
          criteria_json: Json | null
          description: string
          icon: string
          id: string
          is_hidden: boolean | null
          name: string
          points_reward: number
          rarity: string
          sort_order: number | null
        }
        Insert: {
          category: string
          code?: string | null
          created_at?: string
          criteria?: Json
          criteria_json?: Json | null
          description: string
          icon: string
          id?: string
          is_hidden?: boolean | null
          name: string
          points_reward?: number
          rarity?: string
          sort_order?: number | null
        }
        Update: {
          category?: string
          code?: string | null
          created_at?: string
          criteria?: Json
          criteria_json?: Json | null
          description?: string
          icon?: string
          id?: string
          is_hidden?: boolean | null
          name?: string
          points_reward?: number
          rarity?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      basal_body_temperature: {
        Row: {
          created_at: string | null
          id: string
          measurement_date: string
          measurement_time: string | null
          notes: string | null
          organization_id: string
          sleep_quality: number | null
          temperature_celsius: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          measurement_date: string
          measurement_time?: string | null
          notes?: string | null
          organization_id: string
          sleep_quality?: number | null
          temperature_celsius: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          measurement_date?: string
          measurement_time?: string | null
          notes?: string | null
          organization_id?: string
          sleep_quality?: number | null
          temperature_celsius?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "basal_body_temperature_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "basal_body_temperature_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "basal_body_temperature_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "basal_body_temperature_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "basal_body_temperature_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "basal_body_temperature_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      coach_comments: {
        Row: {
          athlete_id: string
          coach_id: string
          comment: string
          created_at: string
          id: string
          is_read: boolean
          related_record_id: string | null
          related_record_type: string | null
          sentiment: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          comment: string
          created_at?: string
          id?: string
          is_read?: boolean
          related_record_id?: string | null
          related_record_type?: string | null
          sentiment?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          comment?: string
          created_at?: string
          id?: string
          is_read?: boolean
          related_record_id?: string | null
          related_record_type?: string | null
          sentiment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_comments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_comments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_comments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_comments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_comments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "coach_comments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_comments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_comments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_comments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_comments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      daily_reflections: {
        Row: {
          created_at: string
          id: string
          reflection_date: string
          text: string
          updated_at: string
          user_id: string
          visibility: string
          word_count: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          reflection_date: string
          text: string
          updated_at?: string
          user_id: string
          visibility?: string
          word_count?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          reflection_date?: string
          text?: string
          updated_at?: string
          user_id?: string
          visibility?: string
          word_count?: number | null
        }
        Relationships: []
      }
      data_sharing_settings: {
        Row: {
          allow_body: boolean
          allow_condition: boolean
          allow_free_note: boolean
          allow_reflection: boolean
          allow_training: boolean
          athlete_user_id: string
          created_at: string
          end_date: string
          id: string
          staff_user_id: string | null
          start_date: string
          team_id: string
          updated_at: string
        }
        Insert: {
          allow_body?: boolean
          allow_condition?: boolean
          allow_free_note?: boolean
          allow_reflection?: boolean
          allow_training?: boolean
          athlete_user_id: string
          created_at?: string
          end_date: string
          id?: string
          staff_user_id?: string | null
          start_date: string
          team_id: string
          updated_at?: string
        }
        Update: {
          allow_body?: boolean
          allow_condition?: boolean
          allow_free_note?: boolean
          allow_reflection?: boolean
          allow_training?: boolean
          athlete_user_id?: string
          created_at?: string
          end_date?: string
          id?: string
          staff_user_id?: string | null
          start_date?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_sharing_settings_athlete_user_id_fkey"
            columns: ["athlete_user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_sharing_settings_athlete_user_id_fkey"
            columns: ["athlete_user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "data_sharing_settings_athlete_user_id_fkey"
            columns: ["athlete_user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "data_sharing_settings_athlete_user_id_fkey"
            columns: ["athlete_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_sharing_settings_athlete_user_id_fkey"
            columns: ["athlete_user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "data_sharing_settings_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_sharing_settings_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "data_sharing_settings_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "data_sharing_settings_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_sharing_settings_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "data_sharing_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      department_managers: {
        Row: {
          created_at: string | null
          department_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          department_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          department_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_managers_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "department_managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "department_managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          alert_category: string | null
          body: string | null
          created_at: string | null
          email: string | null
          email_type: string
          error_message: string | null
          id: string
          status: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          alert_category?: string | null
          body?: string | null
          created_at?: string | null
          email?: string | null
          email_type: string
          error_message?: string | null
          id?: string
          status: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          alert_category?: string | null
          body?: string | null
          created_at?: string | null
          email?: string | null
          email_type?: string
          error_message?: string | null
          id?: string
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      engine_events: {
        Row: {
          created_at: string
          event_date: string
          event_type: string
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          event_date: string
          event_type: string
          id?: string
          payload?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          event_date?: string
          event_type?: string
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      engine_states: {
        Row: {
          last_active_date: string | null
          level: number
          streak_best: number
          streak_current: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          last_active_date?: string | null
          level?: number
          streak_best?: number
          streak_current?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          last_active_date?: string | null
          level?: number
          streak_best?: number
          streak_current?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      events: {
        Row: {
          event_type: string
          id: string
          occurred_at: string
          payload: Json
          process_error: string | null
          processed_at: string | null
          processed_by: string | null
          user_id: string
        }
        Insert: {
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json
          process_error?: string | null
          processed_at?: string | null
          processed_by?: string | null
          user_id: string
        }
        Update: {
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json
          process_error?: string | null
          processed_at?: string | null
          processed_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      generated_reports: {
        Row: {
          athlete_ids: string[] | null
          config_id: string | null
          created_at: string | null
          detailed_data: Json
          error_message: string | null
          generated_at: string | null
          generated_by: string | null
          generation_status: string | null
          id: string
          insights: Json | null
          organization_id: string | null
          pdf_url: string | null
          period_end: string
          period_start: string
          recommendations: Json | null
          report_type: string
          schedule_id: string | null
          summary_data: Json
          team_id: string | null
          title: string
          view_count: number | null
          viewed_at: string | null
        }
        Insert: {
          athlete_ids?: string[] | null
          config_id?: string | null
          created_at?: string | null
          detailed_data?: Json
          error_message?: string | null
          generated_at?: string | null
          generated_by?: string | null
          generation_status?: string | null
          id?: string
          insights?: Json | null
          organization_id?: string | null
          pdf_url?: string | null
          period_end: string
          period_start: string
          recommendations?: Json | null
          report_type: string
          schedule_id?: string | null
          summary_data?: Json
          team_id?: string | null
          title: string
          view_count?: number | null
          viewed_at?: string | null
        }
        Update: {
          athlete_ids?: string[] | null
          config_id?: string | null
          created_at?: string | null
          detailed_data?: Json
          error_message?: string | null
          generated_at?: string | null
          generated_by?: string | null
          generation_status?: string | null
          id?: string
          insights?: Json | null
          organization_id?: string | null
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          recommendations?: Json | null
          report_type?: string
          schedule_id?: string | null
          summary_data?: Json
          team_id?: string | null
          title?: string
          view_count?: number | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_reports_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "report_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "generated_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "generated_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "generated_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_reports_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "report_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      inbody_records: {
        Row: {
          body_fat_percent: number | null
          created_at: string | null
          height: number | null
          id: string
          measured_at: string
          note: string | null
          phone_number: string | null
          source: string | null
          updated_at: string | null
          user_id: string | null
          weight: number | null
        }
        Insert: {
          body_fat_percent?: number | null
          created_at?: string | null
          height?: number | null
          id?: string
          measured_at: string
          note?: string | null
          phone_number?: string | null
          source?: string | null
          updated_at?: string | null
          user_id?: string | null
          weight?: number | null
        }
        Update: {
          body_fat_percent?: number | null
          created_at?: string | null
          height?: number | null
          id?: string
          measured_at?: string
          note?: string | null
          phone_number?: string | null
          source?: string | null
          updated_at?: string | null
          user_id?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      injury_records: {
        Row: {
          body_part: string
          cause: string | null
          created_at: string | null
          days_out: number | null
          id: string
          injury_type: string
          notes: string | null
          occurred_date: string
          organization_id: string
          recovered_date: string | null
          severity: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body_part: string
          cause?: string | null
          created_at?: string | null
          days_out?: number | null
          id?: string
          injury_type: string
          notes?: string | null
          occurred_date: string
          organization_id: string
          recovered_date?: string | null
          severity: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body_part?: string
          cause?: string | null
          created_at?: string | null
          days_out?: number | null
          id?: string
          injury_type?: string
          notes?: string | null
          occurred_date?: string
          organization_id?: string
          recovered_date?: string | null
          severity?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "injury_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injury_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injury_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "injury_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "injury_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injury_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      injury_risk_assessments: {
        Row: {
          acwr_based_risk: number | null
          assessment_date: string
          created_at: string | null
          fatigue_risk: number | null
          id: string
          recent_injury_risk: number | null
          recommendations: Json | null
          risk_score: number
          user_id: string
          workload_spike_risk: number | null
        }
        Insert: {
          acwr_based_risk?: number | null
          assessment_date: string
          created_at?: string | null
          fatigue_risk?: number | null
          id?: string
          recent_injury_risk?: number | null
          recommendations?: Json | null
          risk_score: number
          user_id: string
          workload_spike_risk?: number | null
        }
        Update: {
          acwr_based_risk?: number | null
          assessment_date?: string
          created_at?: string | null
          fatigue_risk?: number | null
          id?: string
          recent_injury_risk?: number | null
          recommendations?: Json | null
          risk_score?: number
          user_id?: string
          workload_spike_risk?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "injury_risk_assessments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injury_risk_assessments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "injury_risk_assessments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "injury_risk_assessments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injury_risk_assessments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      invitation_tokens: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          name: string
          organization_id: string | null
          role: string
          team_id: string | null
          temporary_password: string
          token: string
          used: boolean | null
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          name: string
          organization_id?: string | null
          role: string
          team_id?: string | null
          temporary_password: string
          token: string
          used?: boolean | null
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          name?: string
          organization_id?: string | null
          role?: string
          team_id?: string | null
          temporary_password?: string
          token?: string
          used?: boolean | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_tokens_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_tokens_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invitation_tokens_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invitation_tokens_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_tokens_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "invitation_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_tokens_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      menstrual_cycles: {
        Row: {
          created_at: string | null
          cycle_end_date: string | null
          cycle_length_days: number | null
          cycle_start_date: string
          flow_intensity: string | null
          id: string
          notes: string | null
          organization_id: string | null
          period_duration_days: number | null
          symptoms: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          cycle_end_date?: string | null
          cycle_length_days?: number | null
          cycle_start_date: string
          flow_intensity?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          period_duration_days?: number | null
          symptoms?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          cycle_end_date?: string | null
          cycle_length_days?: number | null
          cycle_start_date?: string
          flow_intensity?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          period_duration_days?: number | null
          symptoms?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menstrual_cycles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menstrual_cycles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menstrual_cycles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "menstrual_cycles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "menstrual_cycles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menstrual_cycles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          participant1_id: string
          participant2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          participant1_id: string
          participant2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          participant1_id?: string
          participant2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_participant1_id_fkey"
            columns: ["participant1_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_participant1_id_fkey"
            columns: ["participant1_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "message_threads_participant1_id_fkey"
            columns: ["participant1_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "message_threads_participant1_id_fkey"
            columns: ["participant1_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_participant1_id_fkey"
            columns: ["participant1_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "message_threads_participant2_id_fkey"
            columns: ["participant2_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_participant2_id_fkey"
            columns: ["participant2_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "message_threads_participant2_id_fkey"
            columns: ["participant2_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "message_threads_participant2_id_fkey"
            columns: ["participant2_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_participant2_id_fkey"
            columns: ["participant2_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          receiver_id: string
          sender_id: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          receiver_id: string
          sender_id: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          receiver_id?: string
          sender_id?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      motivation_records: {
        Row: {
          created_at: string | null
          date: string
          energy_level: number
          id: string
          mood: string | null
          motivation_level: number
          notes: string | null
          stress_level: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date?: string
          energy_level: number
          id?: string
          mood?: string | null
          motivation_level: number
          notes?: string | null
          stress_level: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          energy_level?: number
          id?: string
          mood?: string | null
          motivation_level?: number
          notes?: string | null
          stress_level?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "motivation_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motivation_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "motivation_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "motivation_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motivation_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      nutrition_daily_reports: {
        Row: {
          action_for_tomorrow: string | null
          c: number
          created_at: string
          f: number
          id: string
          p: number
          report_date: string
          score: number | null
          summary: string | null
          total_calories: number
          updated_at: string
          user_id: string
        }
        Insert: {
          action_for_tomorrow?: string | null
          c?: number
          created_at?: string
          f?: number
          id?: string
          p?: number
          report_date: string
          score?: number | null
          summary?: string | null
          total_calories?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          action_for_tomorrow?: string | null
          c?: number
          created_at?: string
          f?: number
          id?: string
          p?: number
          report_date?: string
          score?: number | null
          summary?: string | null
          total_calories?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_logs: {
        Row: {
          advice_markdown: string | null
          c: number
          created_at: string
          edit_meta: Json | null
          f: number
          id: string
          image_meta: Json | null
          image_path: string | null
          image_url: string | null
          is_edited: boolean
          meal_type: string
          menu_items: Json
          p: number
          record_date: string
          recorded_at: string
          total_calories: number
          updated_at: string
          user_id: string
        }
        Insert: {
          advice_markdown?: string | null
          c?: number
          created_at?: string
          edit_meta?: Json | null
          f?: number
          id?: string
          image_meta?: Json | null
          image_path?: string | null
          image_url?: string | null
          is_edited?: boolean
          meal_type: string
          menu_items?: Json
          p?: number
          record_date?: string
          recorded_at?: string
          total_calories?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          advice_markdown?: string | null
          c?: number
          created_at?: string
          edit_meta?: Json | null
          f?: number
          id?: string
          image_meta?: Json | null
          image_path?: string | null
          image_url?: string | null
          is_edited?: boolean
          meal_type?: string
          menu_items?: Json
          p?: number
          record_date?: string
          recorded_at?: string
          total_calories?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_plans: {
        Row: {
          action_goals: Json | null
          activity_level: string | null
          ai_advice: string | null
          bmr: number | null
          created_at: string
          feasibility: string | null
          goal_type: string | null
          id: string
          is_active: boolean
          target_c: number | null
          target_calories: number | null
          target_date: string | null
          target_f: number | null
          target_p: number | null
          target_weight: number | null
          tdee: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_goals?: Json | null
          activity_level?: string | null
          ai_advice?: string | null
          bmr?: number | null
          created_at?: string
          feasibility?: string | null
          goal_type?: string | null
          id?: string
          is_active?: boolean
          target_c?: number | null
          target_calories?: number | null
          target_date?: string | null
          target_f?: number | null
          target_p?: number | null
          target_weight?: number | null
          tdee?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_goals?: Json | null
          activity_level?: string | null
          ai_advice?: string | null
          bmr?: number | null
          created_at?: string
          feasibility?: string | null
          goal_type?: string | null
          id?: string
          is_active?: boolean
          target_c?: number | null
          target_calories?: number | null
          target_date?: string | null
          target_f?: number | null
          target_p?: number | null
          target_weight?: number | null
          tdee?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      performance_categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      performance_records: {
        Row: {
          created_at: string | null
          date: string
          id: string
          is_official: boolean | null
          notes: string | null
          test_type_id: string
          updated_at: string | null
          user_id: string
          values: Json
          weather_conditions: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          is_official?: boolean | null
          notes?: string | null
          test_type_id: string
          updated_at?: string | null
          user_id: string
          values: Json
          weather_conditions?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          is_official?: boolean | null
          notes?: string | null
          test_type_id?: string
          updated_at?: string | null
          user_id?: string
          values?: Json
          weather_conditions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_records_test_type_id_fkey"
            columns: ["test_type_id"]
            isOneToOne: false
            referencedRelation: "performance_test_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "performance_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "performance_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      performance_test_types: {
        Row: {
          category_id: string
          created_at: string | null
          description: string | null
          display_name: string
          fields: Json | null
          higher_is_better: boolean | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          unit: string
          user_can_input: boolean | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          description?: string | null
          display_name: string
          fields?: Json | null
          higher_is_better?: boolean | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          unit: string
          user_can_input?: boolean | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          description?: string | null
          display_name?: string
          fields?: Json | null
          higher_is_better?: boolean | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          unit?: string
          user_can_input?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_test_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "performance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_test_types_backup: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          display_name: string | null
          fields: Json | null
          higher_is_better: boolean | null
          id: string | null
          is_active: boolean | null
          name: string | null
          sort_order: number | null
          unit: string | null
          user_can_input: boolean | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          fields?: Json | null
          higher_is_better?: boolean | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          sort_order?: number | null
          unit?: string | null
          user_can_input?: boolean | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          fields?: Json | null
          higher_is_better?: boolean | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          sort_order?: number | null
          unit?: string | null
          user_can_input?: boolean | null
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          category: string
          created_at: string
          id: string
          metadata: Json | null
          points: number
          reason: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          metadata?: Json | null
          points: number
          reason: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          points?: number
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "point_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "point_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      reflections: {
        Row: {
          cause_tags: string[]
          created_at: string
          did: string | null
          didnt: string | null
          free_note: string | null
          id: string
          metadata: Json
          next_action: string | null
          next_action_items: Json | null
          reflection_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cause_tags?: string[]
          created_at?: string
          did?: string | null
          didnt?: string | null
          free_note?: string | null
          id?: string
          metadata?: Json
          next_action?: string | null
          next_action_items?: Json | null
          reflection_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cause_tags?: string[]
          created_at?: string
          did?: string | null
          didnt?: string | null
          free_note?: string | null
          id?: string
          metadata?: Json
          next_action?: string | null
          next_action_items?: Json | null
          reflection_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reflections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reflections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reflections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reflections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reflections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      report_configs: {
        Row: {
          compare_with_previous: boolean | null
          created_at: string | null
          created_by: string | null
          description: string | null
          highlight_high_risk: boolean | null
          id: string
          include_acwr: boolean | null
          include_alerts: boolean | null
          include_motivation: boolean | null
          include_performance: boolean | null
          include_sleep: boolean | null
          include_team_average: boolean | null
          include_training_load: boolean | null
          include_weight: boolean | null
          is_active: boolean | null
          name: string
          organization_id: string | null
          period_type: string
          settings: Json | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          compare_with_previous?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          highlight_high_risk?: boolean | null
          id?: string
          include_acwr?: boolean | null
          include_alerts?: boolean | null
          include_motivation?: boolean | null
          include_performance?: boolean | null
          include_sleep?: boolean | null
          include_team_average?: boolean | null
          include_training_load?: boolean | null
          include_weight?: boolean | null
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          period_type: string
          settings?: Json | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          compare_with_previous?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          highlight_high_risk?: boolean | null
          id?: string
          include_acwr?: boolean | null
          include_alerts?: boolean | null
          include_motivation?: boolean | null
          include_performance?: boolean | null
          include_sleep?: boolean | null
          include_team_average?: boolean | null
          include_training_load?: boolean | null
          include_weight?: boolean | null
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          period_type?: string
          settings?: Json | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "report_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "report_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "report_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_configs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      report_history: {
        Row: {
          created_at: string | null
          error_message: string | null
          file_path: string | null
          generated_by: string
          id: string
          organization_id: string
          parameters: Json | null
          report_type: string
          scheduled_report_id: string | null
          status: string
          template_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          file_path?: string | null
          generated_by: string
          id?: string
          organization_id: string
          parameters?: Json | null
          report_type: string
          scheduled_report_id?: string | null
          status?: string
          template_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          file_path?: string | null
          generated_by?: string
          id?: string
          organization_id?: string
          parameters?: Json | null
          report_type?: string
          scheduled_report_id?: string | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_history_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_history_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "report_history_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "report_history_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_history_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "report_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_history_scheduled_report_id_fkey"
            columns: ["scheduled_report_id"]
            isOneToOne: false
            referencedRelation: "scheduled_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_history_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          config_id: string
          created_at: string | null
          day_of_month: number | null
          day_of_week: number | null
          frequency: string
          id: string
          is_active: boolean | null
          last_run_at: string | null
          next_run_at: string | null
          save_to_history: boolean | null
          send_email: boolean | null
          time_of_day: string | null
          updated_at: string | null
        }
        Insert: {
          config_id: string
          created_at?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          frequency: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          next_run_at?: string | null
          save_to_history?: boolean | null
          send_email?: boolean | null
          time_of_day?: string | null
          updated_at?: string | null
        }
        Update: {
          config_id?: string
          created_at?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          next_run_at?: string | null
          save_to_history?: boolean | null
          send_email?: boolean | null
          time_of_day?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "report_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      report_subscriptions: {
        Row: {
          config_id: string
          created_at: string | null
          email_address: string | null
          id: string
          is_active: boolean | null
          notify_on_generation: boolean | null
          notify_on_high_risk: boolean | null
          receive_email: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          config_id: string
          created_at?: string | null
          email_address?: string | null
          id?: string
          is_active?: boolean | null
          notify_on_generation?: boolean | null
          notify_on_high_risk?: boolean | null
          receive_email?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          config_id?: string
          created_at?: string | null
          email_address?: string | null
          id?: string
          is_active?: boolean | null
          notify_on_generation?: boolean | null
          notify_on_high_risk?: boolean | null
          receive_email?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_subscriptions_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "report_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "report_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "report_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      report_templates: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          filters: Json | null
          id: string
          is_default: boolean | null
          metrics: Json | null
          name: string
          organization_id: string
          report_type: string
          sections: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          filters?: Json | null
          id?: string
          is_default?: boolean | null
          metrics?: Json | null
          name: string
          organization_id: string
          report_type: string
          sections?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          filters?: Json | null
          id?: string
          is_default?: boolean | null
          metrics?: Json | null
          name?: string
          organization_id?: string
          report_type?: string
          sections?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "report_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "report_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "report_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          created_at: string | null
          created_by: string
          filters: Json | null
          id: string
          is_active: boolean | null
          last_run: string | null
          name: string
          next_run: string | null
          organization_id: string
          recipients: Json
          schedule_config: Json
          schedule_type: string
          template_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          last_run?: string | null
          name: string
          next_run?: string | null
          organization_id: string
          recipients?: Json
          schedule_config?: Json
          schedule_type: string
          template_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          last_run?: string | null
          name?: string
          next_run?: string | null
          organization_id?: string
          recipients?: Json
          schedule_config?: Json
          schedule_type?: string
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "scheduled_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "scheduled_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "scheduled_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_reports_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_reports: {
        Row: {
          created_at: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "shared_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "shared_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      sleep_records: {
        Row: {
          bedtime: string | null
          created_at: string | null
          date: string
          id: string
          notes: string | null
          sleep_hours: number
          sleep_quality: number | null
          updated_at: string | null
          user_id: string
          waketime: string | null
        }
        Insert: {
          bedtime?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          sleep_hours: number
          sleep_quality?: number | null
          updated_at?: string | null
          user_id: string
          waketime?: string | null
        }
        Update: {
          bedtime?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          sleep_hours?: number
          sleep_quality?: number | null
          updated_at?: string | null
          user_id?: string
          waketime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sleep_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sleep_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sleep_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sleep_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sleep_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      staff_team_links: {
        Row: {
          created_at: string | null
          id: string
          staff_user_id: string
          team_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          staff_user_id: string
          team_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          staff_user_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_team_links_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_team_links_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "staff_team_links_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "staff_team_links_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_team_links_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "staff_team_links_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_access_requests: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          request_message: string | null
          requester_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          team_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          request_message?: string | null
          requester_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: string
          team_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          request_message?: string | null
          requester_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_access_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_access_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_access_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_access_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_access_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_access_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "team_access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "team_access_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_achievement_notifications: {
        Row: {
          achievement_id: string
          created_at: string
          id: string
          is_read: boolean
          team_id: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          team_id: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_achievement_notifications_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "team_achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_achievement_notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_achievement_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_achievement_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_achievement_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_achievement_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_achievement_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      team_achievements: {
        Row: {
          achieved_at: string
          achievement_type: string
          celebrated: boolean
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          team_id: string
          title: string
        }
        Insert: {
          achieved_at?: string
          achievement_type: string
          celebrated?: boolean
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          team_id: string
          title: string
        }
        Update: {
          achieved_at?: string
          achievement_type?: string
          celebrated?: boolean
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          team_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_achievements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_assignment_history: {
        Row: {
          assigned_by: string | null
          assignment_reason: string | null
          change_type: string
          changed_at: string
          from_team_id: string | null
          id: string
          organization_id: string
          to_team_id: string | null
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          assignment_reason?: string | null
          change_type: string
          changed_at?: string
          from_team_id?: string | null
          id?: string
          organization_id: string
          to_team_id?: string | null
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          assignment_reason?: string | null
          change_type?: string
          changed_at?: string
          from_team_id?: string | null
          id?: string
          organization_id?: string
          to_team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_assignment_history_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_assignment_history_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_assignment_history_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_assignment_history_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_assignment_history_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "team_assignment_history_from_team_id_fkey"
            columns: ["from_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_assignment_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_assignment_history_to_team_id_fkey"
            columns: ["to_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_assignment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_assignment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_assignment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_assignment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_assignment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      team_member_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assignment_type: string
          created_at: string | null
          id: string
          notes: string | null
          organization_id: string
          team_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_type: string
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          team_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_type?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          team_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_member_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_member_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_member_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "team_member_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_member_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_member_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      team_transfer_history: {
        Row: {
          athlete_id: string
          from_team_id: string | null
          id: string
          metadata: Json | null
          organization_id: string
          to_team_id: string
          transfer_date: string | null
          transfer_reason: string | null
          transfer_request_id: string | null
          transferred_by: string
        }
        Insert: {
          athlete_id: string
          from_team_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          to_team_id: string
          transfer_date?: string | null
          transfer_reason?: string | null
          transfer_request_id?: string | null
          transferred_by: string
        }
        Update: {
          athlete_id?: string
          from_team_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          to_team_id?: string
          transfer_date?: string | null
          transfer_reason?: string | null
          transfer_request_id?: string | null
          transferred_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_transfer_history_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_transfer_history_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_transfer_history_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_transfer_history_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_transfer_history_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "team_transfer_history_from_team_id_fkey"
            columns: ["from_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_transfer_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_transfer_history_to_team_id_fkey"
            columns: ["to_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_transfer_history_transfer_request_id_fkey"
            columns: ["transfer_request_id"]
            isOneToOne: false
            referencedRelation: "athlete_transfer_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_transfer_history_transferred_by_fkey"
            columns: ["transferred_by"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_transfer_history_transferred_by_fkey"
            columns: ["transferred_by"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_transfer_history_transferred_by_fkey"
            columns: ["transferred_by"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_transfer_history_transferred_by_fkey"
            columns: ["transferred_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_transfer_history_transferred_by_fkey"
            columns: ["transferred_by"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          department_id: string | null
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_records: {
        Row: {
          arrow_score: number
          created_at: string | null
          date: string
          duration_min: number
          growth_vector: number | null
          id: string
          intent_signal: number | null
          load: number | null
          rpe: number
          signal_score: number
          user_id: string
        }
        Insert: {
          arrow_score?: number
          created_at?: string | null
          date?: string
          duration_min: number
          growth_vector?: number | null
          id?: string
          intent_signal?: number | null
          load?: number | null
          rpe: number
          signal_score?: number
          user_id: string
        }
        Update: {
          arrow_score?: number
          created_at?: string | null
          date?: string
          duration_min?: number
          growth_vector?: number | null
          id?: string
          intent_signal?: number | null
          load?: number | null
          rpe?: number
          signal_score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "training_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "training_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      tutorial_progress: {
        Row: {
          completed_steps: Json | null
          created_at: string | null
          current_step: string | null
          id: string
          is_completed: boolean | null
          last_updated: string | null
          role: string
          skipped: boolean | null
          user_id: string
        }
        Insert: {
          completed_steps?: Json | null
          created_at?: string | null
          current_step?: string | null
          id?: string
          is_completed?: boolean | null
          last_updated?: string | null
          role: string
          skipped?: boolean | null
          user_id: string
        }
        Update: {
          completed_steps?: Json | null
          created_at?: string | null
          current_step?: string | null
          id?: string
          is_completed?: boolean | null
          last_updated?: string | null
          role?: string
          skipped?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutorial_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tutorial_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tutorial_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutorial_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          is_new: boolean
          metadata: Json | null
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          is_new?: boolean
          metadata?: Json | null
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          is_new?: boolean
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      user_goals: {
        Row: {
          completed_at: string | null
          created_at: string
          current_value: number | null
          deadline: string | null
          description: string | null
          goal_type: string
          id: string
          metadata: Json | null
          status: string | null
          target_value: number | null
          test_type_id: string | null
          title: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          goal_type: string
          id?: string
          metadata?: Json | null
          status?: string | null
          target_value?: number | null
          test_type_id?: string | null
          title: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          goal_type?: string
          id?: string
          metadata?: Json | null
          status?: string | null
          target_value?: number | null
          test_type_id?: string | null
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_goals_test_type_id_fkey"
            columns: ["test_type_id"]
            isOneToOne: false
            referencedRelation: "performance_test_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      user_phone_links: {
        Row: {
          created_at: string
          phone_normalized: string
          phone_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          phone_normalized: string
          phone_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          phone_normalized?: string
          phone_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_points: {
        Row: {
          created_at: string
          current_level: number
          id: string
          points_to_next_level: number
          rank_level: string | null
          rank_tier: string | null
          rank_title: string
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_level?: number
          id?: string
          points_to_next_level?: number
          rank_level?: string | null
          rank_tier?: string | null
          rank_title?: string
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_level?: number
          id?: string
          points_to_next_level?: number
          rank_level?: string | null
          rank_tier?: string | null
          rank_title?: string
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_recorded_date: string | null
          longest_streak: number
          streak_freeze_count: number
          streak_type: string
          total_records: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_recorded_date?: string | null
          longest_streak?: number
          streak_freeze_count?: number
          streak_type: string
          total_records?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_recorded_date?: string | null
          longest_streak?: number
          streak_freeze_count?: number
          streak_type?: string
          total_records?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      user_team_memberships: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          role: string
          start_date: string | null
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          role?: string
          start_date?: string | null
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          role?: string
          start_date?: string | null
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_team_memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_team_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_team_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_team_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_team_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_team_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          email: string
          email_notifications: Json | null
          gender: string | null
          height_cm: number | null
          id: string
          last_alert_email_sent: string | null
          name: string
          phone_number: string | null
          role: string
          team_id: string | null
          terms_accepted: boolean
          terms_accepted_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date_of_birth?: string | null
          email: string
          email_notifications?: Json | null
          gender?: string | null
          height_cm?: number | null
          id: string
          last_alert_email_sent?: string | null
          name: string
          phone_number?: string | null
          role: string
          team_id?: string | null
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string | null
          email?: string
          email_notifications?: Json | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          last_alert_email_sent?: string | null
          name?: string
          phone_number?: string | null
          role?: string
          team_id?: string | null
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_records: {
        Row: {
          created_at: string | null
          date: string
          id: string
          notes: string | null
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
    }
    Views: {
      personal_bests: {
        Row: {
          created_at: string | null
          date: string | null
          higher_is_better: boolean | null
          id: string | null
          primary_value: number | null
          relative_1rm: number | null
          test_display_name: string | null
          test_name: string | null
          test_type_id: string | null
          unit: string | null
          user_id: string | null
          values: Json | null
          weight_at_test: number | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_records_test_type_id_fkey"
            columns: ["test_type_id"]
            isOneToOne: false
            referencedRelation: "performance_test_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "performance_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "performance_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
        ]
      }
      staff_team_athletes_with_activity: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          email_notifications: Json | null
          gender: string | null
          height_cm: number | null
          id: string | null
          last_alert_email_sent: string | null
          last_training_date: string | null
          name: string | null
          role: string | null
          team_id: string | null
          terms_accepted: boolean | null
          terms_accepted_at: string | null
          training_days_28d: number | null
          training_sessions_28d: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_points_rankings: {
        Row: {
          current_level: number | null
          rank: number | null
          team_id: string | null
          total_points: number | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_weekly_rankings: {
        Row: {
          rank: number | null
          team_id: string | null
          user_id: string | null
          user_name: string | null
          weekly_records: number | null
        }
        Relationships: [
          {
            foreignKeyName: "users_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_daily_flags_jst: {
        Row: {
          has_all: boolean | null
          has_training: boolean | null
          has_weight: boolean | null
          jst_day: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_staff_team_athletes: {
        Row: {
          athlete_user_id: string | null
          staff_user_id: string | null
          team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_team_links_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_team_athletes_with_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_team_links_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "team_points_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "staff_team_links_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_rankings"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "staff_team_links_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_team_links_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "v_staff_team_athletes"
            referencedColumns: ["athlete_user_id"]
          },
          {
            foreignKeyName: "staff_team_links_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_strength_record_with_relative_1rm: {
        Args: {
          p_1rm: number
          p_date: string
          p_is_official?: boolean
          p_notes?: string
          p_test_type_id: string
          p_user_id: string
        }
        Returns: string
      }
      approve_athlete_transfer: {
        Args: { notes?: string; request_id: string; reviewer_user_id: string }
        Returns: undefined
      }
      approve_team_access_request: {
        Args: { notes?: string; request_id: string; reviewer_user_id: string }
        Returns: undefined
      }
      assign_user_to_team: {
        Args: {
          p_assignment_type?: string
          p_notes?: string
          p_organization_id: string
          p_team_id: string
          p_user_id: string
        }
        Returns: string
      }
      award_points: {
        Args: {
          p_category: string
          p_metadata?: Json
          p_points: number
          p_reason: string
          p_user_id: string
        }
        Returns: undefined
      }
      backfill_rank_reach_badges: {
        Args: { p_user_id?: string }
        Returns: undefined
      }
      calculate_injury_risk: {
        Args: { p_date: string; p_user_id: string }
        Returns: number
      }
      calculate_next_run: {
        Args: {
          p_from_date?: string
          p_schedule_config: Json
          p_schedule_type: string
        }
        Returns: string
      }
      calculate_relative_1rm: {
        Args: { p_1rm: number; p_weight: number }
        Returns: number
      }
      call_alert_daily_summary: { Args: never; Returns: undefined }
      can_read_user: { Args: { target_user_id: string }; Returns: boolean }
      cleanup_empty_threads: { Args: never; Returns: number }
      cleanup_messaging_data: { Args: never; Returns: Json }
      cleanup_old_messages: { Args: never; Returns: number }
      current_user_role: { Args: never; Returns: string }
      earn_badge: {
        Args: { p_badge_name: string; p_metadata?: Json; p_user_id: string }
        Returns: boolean
      }
      get_athlete_transfer_history: {
        Args: { athlete_user_id: string }
        Returns: {
          from_team_name: string
          id: string
          to_team_name: string
          transfer_date: string
          transfer_reason: string
          transferred_by_name: string
        }[]
      }
      get_coach_week_athlete_cards: {
        Args: { p_end_date: string; p_start_date: string; p_team_id: string }
        Returns: {
          action_done: number
          action_done_rate: number
          action_total: number
          allow_body: boolean
          allow_condition: boolean
          allow_free_note: boolean
          allow_reflection: boolean
          allow_training: boolean
          athlete_email: string
          athlete_name: string
          athlete_user_id: string
          energy_avg: number
          is_sharing_active: boolean
          motivation_avg: number
          sleep_hours_avg: number
          sleep_quality_avg: number
          stress_avg: number
          team_id: string
          week_duration_min: number
          week_load_sum: number
          week_rpe_avg: number
        }[]
      }
      get_coach_week_cause_tags: {
        Args: { p_end_date: string; p_start_date: string; p_team_id: string }
        Returns: {
          cnt: number
          tag: string
          team_id: string
        }[]
      }
      get_latest_weight: { Args: { p_user_id: string }; Returns: number }
      get_team_cause_tags: {
        Args: { p_end_date: string; p_start_date: string; p_team_id: string }
        Returns: {
          cnt: number
          tag: string
          team_id: string
        }[]
      }
      get_team_members_with_assignments: {
        Args: { p_team_id: string }
        Returns: {
          assigned_at: string
          assigned_by_name: string
          assignment_type: string
          user_email: string
          user_id: string
          user_name: string
          user_role: string
        }[]
      }
      get_unassigned_organization_members: {
        Args: { p_organization_id: string }
        Returns: {
          user_email: string
          user_id: string
          user_name: string
          user_role: string
        }[]
      }
      grant_badge_no_points: {
        Args: { p_badge_name: string; p_metadata?: Json; p_user_id: string }
        Returns: boolean
      }
      is_organization_admin: {
        Args: { check_user_id: string; org_id: string }
        Returns: boolean
      }
      is_staff_or_admin: { Args: never; Returns: boolean }
      mark_team_achievement_celebrated: {
        Args: { p_achievement_id: string }
        Returns: undefined
      }
      mark_team_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      normalize_phone: { Args: { p: string }; Returns: string }
      rebuild_all_user_streaks_jst: { Args: never; Returns: undefined }
      recalculate_user_points: {
        Args: { p_user_id?: string }
        Returns: undefined
      }
      record_team_achievement: {
        Args: {
          p_achievement_type: string
          p_description: string
          p_metadata?: Json
          p_team_id: string
          p_title: string
        }
        Returns: string
      }
      reject_athlete_transfer: {
        Args: { notes?: string; request_id: string; reviewer_user_id: string }
        Returns: undefined
      }
      reject_team_access_request: {
        Args: { notes?: string; request_id: string; reviewer_user_id: string }
        Returns: undefined
      }
      remove_user_from_team: {
        Args: {
          p_assignment_type?: string
          p_organization_id: string
          p_team_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      update_athlete_team: {
        Args: { athlete_id: string; new_team_id: string }
        Returns: boolean
      }
      update_user_streak: {
        Args: {
          p_record_date: string
          p_streak_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      upsert_reflection: {
        Args: {
          p_award?: boolean
          p_award_points?: number
          p_cause_tags?: string[]
          p_did?: string
          p_didnt?: string
          p_free_note?: string
          p_metadata?: Json
          p_next_action?: string
          p_reflection_date: string
        }
        Returns: string
      }
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
