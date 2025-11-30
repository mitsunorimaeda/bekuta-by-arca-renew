export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          email: string;
          role: 'athlete' | 'staff' | 'admin';
          team_id: string | null;
          gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
          height_cm: number | null;
          date_of_birth: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          name: string;
          email: string;
          role: 'athlete' | 'staff' | 'admin';
          team_id?: string | null;
          gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
          height_cm?: number | null;
          date_of_birth?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          email?: string;
          role?: 'athlete' | 'staff' | 'admin';
          team_id?: string | null;
          gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
          height_cm?: number | null;
          date_of_birth?: string | null;
          created_at?: string;
        };
      };
      teams: {
        Row: {
          id: string;
          name: string;
          description: string;
          settings: Record<string, any>;
          organization_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          settings?: Record<string, any>;
          organization_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          settings?: Record<string, any>;
          organization_id?: string | null;
          created_at?: string;
        };
      };
      staff_team_links: {
        Row: {
          id: string;
          staff_user_id: string;
          team_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_user_id: string;
          team_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          staff_user_id?: string;
          team_id?: string;
          created_at?: string;
        };
      };
      training_records: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          rpe: number;
          duration_min: number;
          load: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date?: string;
          rpe: number;
          duration_min: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          rpe?: number;
          duration_min?: number;
          created_at?: string;
        };
      };
      weight_records: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          weight_kg: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date?: string;
          weight_kg: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          weight_kg?: number;
          notes?: string | null;
          created_at?: string;
        };
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          description: string;
          settings: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          settings?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          settings?: Record<string, any>;
          updated_at?: string;
        };
      };
      organization_members: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          role: 'organization_admin' | 'member';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          role: 'organization_admin' | 'member';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string;
          role?: 'organization_admin' | 'member';
        };
      };
      subscription_plans: {
        Row: {
          id: string;
          name: string;
          description: string;
          price_monthly: number;
          price_yearly: number;
          athlete_limit: number | null;
          storage_gb: number;
          features: Record<string, any>;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          price_monthly: number;
          price_yearly: number;
          athlete_limit?: number | null;
          storage_gb?: number;
          features?: Record<string, any>;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          price_monthly?: number;
          price_yearly?: number;
          athlete_limit?: number | null;
          storage_gb?: number;
          features?: Record<string, any>;
          is_active?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
      };
      organization_subscriptions: {
        Row: {
          id: string;
          organization_id: string;
          plan_id: string;
          status: 'active' | 'trial' | 'expired' | 'cancelled';
          billing_cycle: 'monthly' | 'yearly';
          current_period_start: string;
          current_period_end: string;
          trial_end: string | null;
          cancel_at_period_end: boolean;
          billing_email: string;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          plan_id: string;
          status: 'active' | 'trial' | 'expired' | 'cancelled';
          billing_cycle: 'monthly' | 'yearly';
          current_period_start: string;
          current_period_end: string;
          trial_end?: string | null;
          cancel_at_period_end?: boolean;
          billing_email: string;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          plan_id?: string;
          status?: 'active' | 'trial' | 'expired' | 'cancelled';
          billing_cycle?: 'monthly' | 'yearly';
          current_period_start?: string;
          current_period_end?: string;
          trial_end?: string | null;
          cancel_at_period_end?: boolean;
          billing_email?: string;
          metadata?: Record<string, any>;
          updated_at?: string;
        };
      };
      user_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          status: 'active' | 'trial' | 'expired' | 'cancelled';
          billing_cycle: 'monthly' | 'yearly';
          current_period_start: string;
          current_period_end: string;
          trial_end: string | null;
          cancel_at_period_end: boolean;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          status: 'active' | 'trial' | 'expired' | 'cancelled';
          billing_cycle: 'monthly' | 'yearly';
          current_period_start: string;
          current_period_end: string;
          trial_end?: string | null;
          cancel_at_period_end?: boolean;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_id?: string;
          status?: 'active' | 'trial' | 'expired' | 'cancelled';
          billing_cycle?: 'monthly' | 'yearly';
          current_period_start?: string;
          current_period_end?: string;
          trial_end?: string | null;
          cancel_at_period_end?: boolean;
          metadata?: Record<string, any>;
          updated_at?: string;
        };
      };
      usage_tracking: {
        Row: {
          id: string;
          organization_id: string;
          period_start: string;
          period_end: string;
          active_athletes: number;
          total_users: number;
          storage_used_mb: number;
          api_calls: number;
          data_exports: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          period_start: string;
          period_end: string;
          active_athletes?: number;
          total_users?: number;
          storage_used_mb?: number;
          api_calls?: number;
          data_exports?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          period_start?: string;
          period_end?: string;
          active_athletes?: number;
          total_users?: number;
          storage_used_mb?: number;
          api_calls?: number;
          data_exports?: number;
        };
      };
      billing_history: {
        Row: {
          id: string;
          organization_id: string | null;
          user_id: string | null;
          subscription_id: string;
          amount: number;
          currency: string;
          status: 'paid' | 'pending' | 'failed' | 'refunded';
          billing_date: string;
          paid_date: string | null;
          invoice_url: string | null;
          payment_method: string | null;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          user_id?: string | null;
          subscription_id: string;
          amount: number;
          currency?: string;
          status: 'paid' | 'pending' | 'failed' | 'refunded';
          billing_date: string;
          paid_date?: string | null;
          invoice_url?: string | null;
          payment_method?: string | null;
          notes?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          user_id?: string | null;
          subscription_id?: string;
          amount?: number;
          currency?: string;
          status?: 'paid' | 'pending' | 'failed' | 'refunded';
          billing_date?: string;
          paid_date?: string | null;
          invoice_url?: string | null;
          payment_method?: string | null;
          notes?: string;
        };
      };
      permission_definitions: {
        Row: {
          id: string;
          permission_key: string;
          name: string;
          description: string;
          category: 'athlete' | 'training' | 'reports' | 'organization' | 'billing' | 'admin';
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          permission_key: string;
          name: string;
          description?: string;
          category: 'athlete' | 'training' | 'reports' | 'organization' | 'billing' | 'admin';
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          permission_key?: string;
          name?: string;
          description?: string;
          category?: 'athlete' | 'training' | 'reports' | 'organization' | 'billing' | 'admin';
          is_active?: boolean;
        };
      };
      role_permissions: {
        Row: {
          id: string;
          role: string;
          permission_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          role: string;
          permission_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: string;
          permission_id?: string;
        };
      };
      performance_categories: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          description: string;
          icon: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          description?: string;
          icon?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          display_name?: string;
          description?: string;
          icon?: string;
          sort_order?: number;
          is_active?: boolean;
        };
      };
      performance_test_types: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          display_name: string;
          description: string;
          unit: string;
          higher_is_better: boolean;
          fields: Record<string, any>;
          sort_order: number;
          is_active: boolean;
          user_can_input: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          display_name: string;
          description?: string;
          unit: string;
          higher_is_better?: boolean;
          fields?: Record<string, any>;
          sort_order?: number;
          is_active?: boolean;
          user_can_input?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          display_name?: string;
          description?: string;
          unit?: string;
          higher_is_better?: boolean;
          fields?: Record<string, any>;
          sort_order?: number;
          is_active?: boolean;
          user_can_input?: boolean;
        };
      };
      performance_records: {
        Row: {
          id: string;
          user_id: string;
          test_type_id: string;
          date: string;
          values: Record<string, any>;
          notes: string;
          is_official: boolean;
          weather_conditions: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          test_type_id: string;
          date?: string;
          values: Record<string, any>;
          notes?: string;
          is_official?: boolean;
          weather_conditions?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          test_type_id?: string;
          date?: string;
          values?: Record<string, any>;
          notes?: string;
          is_official?: boolean;
          weather_conditions?: string;
          updated_at?: string;
        };
      };
      sleep_records: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          sleep_hours: number;
          sleep_quality: number | null;
          bedtime: string | null;
          waketime: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date?: string;
          sleep_hours: number;
          sleep_quality?: number | null;
          bedtime?: string | null;
          waketime?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          sleep_hours?: number;
          sleep_quality?: number | null;
          bedtime?: string | null;
          waketime?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      motivation_records: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          motivation_level: number;
          energy_level: number;
          stress_level: number;
          mood: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date?: string;
          motivation_level: number;
          energy_level: number;
          stress_level: number;
          mood?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          motivation_level?: number;
          energy_level?: number;
          stress_level?: number;
          mood?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: {
      organization_stats: {
        Row: {
          id: string;
          name: string;
          description: string;
          created_at: string;
          updated_at: string;
          team_count: number;
          member_count: number;
          admin_count: number;
        };
      };
    };
    Functions: {
      get_organization_hierarchy: {
        Args: { org_id: string };
        Returns: any;
      };
      get_user_organizations: {
        Args: { user_uuid: string };
        Returns: Array<{
          organization_id: string;
          organization_name: string;
          user_role: string;
          member_count: number;
          team_count: number;
        }>;
      };
      get_organization_teams: {
        Args: { org_id: string };
        Returns: Array<{
          id: string;
          name: string;
          description: string;
          settings: Record<string, any>;
          organization_id: string;
          created_at: string;
          member_count: number;
          staff_count: number;
        }>;
      };
      check_orphaned_records: {
        Args: {};
        Returns: Array<{
          record_type: string;
          record_id: string;
          issue: string;
        }>;
      };
    };
    Tables: {
      menstrual_cycles: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          cycle_start_date: string;
          cycle_end_date: string | null;
          period_duration_days: number | null;
          cycle_length_days: number | null;
          flow_intensity: 'light' | 'moderate' | 'heavy' | null;
          symptoms: string[];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          cycle_start_date: string;
          cycle_end_date?: string | null;
          period_duration_days?: number | null;
          cycle_length_days?: number | null;
          flow_intensity?: 'light' | 'moderate' | 'heavy' | null;
          symptoms?: string[];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string;
          cycle_start_date?: string;
          cycle_end_date?: string | null;
          period_duration_days?: number | null;
          cycle_length_days?: number | null;
          flow_intensity?: 'light' | 'moderate' | 'heavy' | null;
          symptoms?: string[];
          notes?: string | null;
          updated_at?: string;
        };
      };
      basal_body_temperature: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          measurement_date: string;
          temperature_celsius: number;
          measurement_time: string | null;
          sleep_quality: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          measurement_date: string;
          temperature_celsius: number;
          measurement_time?: string | null;
          sleep_quality?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string;
          measurement_date?: string;
          temperature_celsius?: number;
          measurement_time?: string | null;
          sleep_quality?: number | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      injury_records: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          injury_type: 'muscle_strain' | 'joint_pain' | 'fracture' | 'concussion' | 'ligament_tear' | 'tendon_injury' | 'stress_fracture' | 'other';
          body_part: 'ankle' | 'knee' | 'hip' | 'hamstring' | 'quadriceps' | 'calf' | 'shoulder' | 'elbow' | 'wrist' | 'back' | 'neck' | 'head' | 'other';
          severity: 'minor' | 'moderate' | 'severe';
          occurred_date: string;
          recovered_date: string | null;
          days_out: number | null;
          cause: 'overtraining' | 'accident' | 'fatigue' | 'technique' | 'equipment' | 'other' | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          injury_type: 'muscle_strain' | 'joint_pain' | 'fracture' | 'concussion' | 'ligament_tear' | 'tendon_injury' | 'stress_fracture' | 'other';
          body_part: 'ankle' | 'knee' | 'hip' | 'hamstring' | 'quadriceps' | 'calf' | 'shoulder' | 'elbow' | 'wrist' | 'back' | 'neck' | 'head' | 'other';
          severity: 'minor' | 'moderate' | 'severe';
          occurred_date: string;
          recovered_date?: string | null;
          days_out?: number | null;
          cause?: 'overtraining' | 'accident' | 'fatigue' | 'technique' | 'equipment' | 'other' | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string;
          injury_type?: 'muscle_strain' | 'joint_pain' | 'fracture' | 'concussion' | 'ligament_tear' | 'tendon_injury' | 'stress_fracture' | 'other';
          body_part?: 'ankle' | 'knee' | 'hip' | 'hamstring' | 'quadriceps' | 'calf' | 'shoulder' | 'elbow' | 'wrist' | 'back' | 'neck' | 'head' | 'other';
          severity?: 'minor' | 'moderate' | 'severe';
          occurred_date?: string;
          recovered_date?: string | null;
          days_out?: number | null;
          cause?: 'overtraining' | 'accident' | 'fatigue' | 'technique' | 'equipment' | 'other' | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      injury_risk_assessments: {
        Row: {
          id: string;
          user_id: string;
          assessment_date: string;
          risk_score: number;
          acwr_based_risk: number | null;
          workload_spike_risk: number | null;
          fatigue_risk: number | null;
          recent_injury_risk: number | null;
          recommendations: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          assessment_date: string;
          risk_score: number;
          acwr_based_risk?: number | null;
          workload_spike_risk?: number | null;
          fatigue_risk?: number | null;
          recent_injury_risk?: number | null;
          recommendations?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          assessment_date?: string;
          risk_score?: number;
          acwr_based_risk?: number | null;
          workload_spike_risk?: number | null;
          fatigue_risk?: number | null;
          recent_injury_risk?: number | null;
          recommendations?: string[];
        };
      };
      report_templates: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          report_type: 'individual' | 'team' | 'organization';
          sections: any[];
          metrics: any[];
          filters: Record<string, any>;
          is_default: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          report_type: 'individual' | 'team' | 'organization';
          sections?: any[];
          metrics?: any[];
          filters?: Record<string, any>;
          is_default?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          description?: string | null;
          report_type?: 'individual' | 'team' | 'organization';
          sections?: any[];
          metrics?: any[];
          filters?: Record<string, any>;
          is_default?: boolean;
          created_by?: string;
          updated_at?: string;
        };
      };
      scheduled_reports: {
        Row: {
          id: string;
          organization_id: string;
          template_id: string;
          name: string;
          schedule_type: 'daily' | 'weekly' | 'monthly';
          schedule_config: Record<string, any>;
          recipients: string[];
          filters: Record<string, any>;
          is_active: boolean;
          last_run: string | null;
          next_run: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          template_id: string;
          name: string;
          schedule_type: 'daily' | 'weekly' | 'monthly';
          schedule_config?: Record<string, any>;
          recipients?: string[];
          filters?: Record<string, any>;
          is_active?: boolean;
          last_run?: string | null;
          next_run?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          template_id?: string;
          name?: string;
          schedule_type?: 'daily' | 'weekly' | 'monthly';
          schedule_config?: Record<string, any>;
          recipients?: string[];
          filters?: Record<string, any>;
          is_active?: boolean;
          last_run?: string | null;
          next_run?: string | null;
          created_by?: string;
          updated_at?: string;
        };
      };
      report_history: {
        Row: {
          id: string;
          organization_id: string;
          template_id: string | null;
          scheduled_report_id: string | null;
          report_type: string;
          generated_by: string;
          parameters: Record<string, any>;
          file_path: string | null;
          status: 'pending' | 'completed' | 'failed';
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          template_id?: string | null;
          scheduled_report_id?: string | null;
          report_type: string;
          generated_by: string;
          parameters?: Record<string, any>;
          file_path?: string | null;
          status?: 'pending' | 'completed' | 'failed';
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          template_id?: string | null;
          scheduled_report_id?: string | null;
          report_type?: string;
          generated_by?: string;
          parameters?: Record<string, any>;
          file_path?: string | null;
          status?: 'pending' | 'completed' | 'failed';
          error_message?: string | null;
        };
      };
    };
  };
}