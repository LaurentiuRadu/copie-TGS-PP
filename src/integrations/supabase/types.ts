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
      active_sessions: {
        Row: {
          created_at: string | null
          device_fingerprint: string
          expires_at: string | null
          id: string
          invalidated_at: string | null
          invalidation_reason: string | null
          last_activity: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_fingerprint: string
          expires_at?: string | null
          id?: string
          invalidated_at?: string | null
          invalidation_reason?: string | null
          last_activity?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_fingerprint?: string
          expires_at?: string | null
          id?: string
          invalidated_at?: string | null
          invalidation_reason?: string | null
          last_activity?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_timesheets: {
        Row: {
          created_at: string
          employee_id: string
          hours_driving: number | null
          hours_equipment: number | null
          hours_holiday: number | null
          hours_leave: number | null
          hours_medical_leave: number | null
          hours_night: number | null
          hours_passenger: number | null
          hours_regular: number | null
          hours_saturday: number | null
          hours_sunday: number | null
          id: string
          notes: string | null
          updated_at: string
          work_date: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          hours_driving?: number | null
          hours_equipment?: number | null
          hours_holiday?: number | null
          hours_leave?: number | null
          hours_medical_leave?: number | null
          hours_night?: number | null
          hours_passenger?: number | null
          hours_regular?: number | null
          hours_saturday?: number | null
          hours_sunday?: number | null
          id?: string
          notes?: string | null
          updated_at?: string
          work_date: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          hours_driving?: number | null
          hours_equipment?: number | null
          hours_holiday?: number | null
          hours_leave?: number | null
          hours_medical_leave?: number | null
          hours_night?: number | null
          hours_passenger?: number | null
          hours_regular?: number | null
          hours_saturday?: number | null
          hours_sunday?: number | null
          id?: string
          notes?: string | null
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_timesheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_retention_policies: {
        Row: {
          auto_delete_enabled: boolean | null
          created_at: string | null
          data_type: string
          id: string
          last_cleanup_run: string | null
          retention_days: number
          updated_at: string | null
        }
        Insert: {
          auto_delete_enabled?: boolean | null
          created_at?: string | null
          data_type: string
          id?: string
          last_cleanup_run?: string | null
          retention_days: number
          updated_at?: string | null
        }
        Update: {
          auto_delete_enabled?: boolean | null
          created_at?: string | null
          data_type?: string
          id?: string
          last_cleanup_run?: string | null
          retention_days?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      face_verification_logs: {
        Row: {
          created_at: string
          failure_reason: string | null
          id: string
          is_match: boolean | null
          is_quality_pass: boolean | null
          match_score: number | null
          photo_url: string
          quality_score: number | null
          time_entry_id: string | null
          user_id: string
          verification_type: string
        }
        Insert: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          is_match?: boolean | null
          is_quality_pass?: boolean | null
          match_score?: number | null
          photo_url: string
          quality_score?: number | null
          time_entry_id?: string | null
          user_id: string
          verification_type: string
        }
        Update: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          is_match?: boolean | null
          is_quality_pass?: boolean | null
          match_score?: number | null
          photo_url?: string
          quality_score?: number | null
          time_entry_id?: string | null
          user_id?: string
          verification_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "face_verification_logs_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      gdpr_requests: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          processed_at: string | null
          processed_by: string | null
          request_type: string
          requested_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          request_type: string
          requested_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          request_type?: string
          requested_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          id: string
          is_recurring: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          id?: string
          is_recurring?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          id?: string
          is_recurring?: boolean | null
          name?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          clock_out_reminder_enabled: boolean | null
          clock_out_reminder_hours: number | null
          created_at: string | null
          id: string
          schedule_changes_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          clock_out_reminder_enabled?: boolean | null
          clock_out_reminder_hours?: number | null
          created_at?: string | null
          id?: string
          schedule_changes_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          clock_out_reminder_enabled?: boolean | null
          clock_out_reminder_hours?: number | null
          created_at?: string | null
          id?: string
          schedule_changes_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          photo_quality_score: number | null
          reference_photo_enrolled_at: string | null
          reference_photo_url: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          photo_quality_score?: number | null
          reference_photo_enrolled_at?: string | null
          reference_photo_url?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          photo_quality_score?: number | null
          reference_photo_enrolled_at?: string | null
          reference_photo_url?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          subscription_data: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          subscription_data: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          subscription_data?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_attempts: {
        Row: {
          attempt_count: number
          attempt_type: string
          blocked_until: string | null
          created_at: string | null
          id: string
          identifier: string
          updated_at: string | null
          window_start: string
        }
        Insert: {
          attempt_count?: number
          attempt_type: string
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          identifier: string
          updated_at?: string | null
          window_start?: string
        }
        Update: {
          attempt_count?: number
          attempt_type?: string
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          identifier?: string
          updated_at?: string | null
          window_start?: string
        }
        Relationships: []
      }
      rate_limit_config: {
        Row: {
          block_duration_minutes: number
          created_at: string | null
          enabled: boolean | null
          id: string
          limit_type: string
          max_attempts: number
          updated_at: string | null
          window_minutes: number
        }
        Insert: {
          block_duration_minutes: number
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          limit_type: string
          max_attempts: number
          updated_at?: string | null
          window_minutes: number
        }
        Update: {
          block_duration_minutes?: number
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          limit_type?: string
          max_attempts?: number
          updated_at?: string | null
          window_minutes?: number
        }
        Relationships: []
      }
      schedule_notifications: {
        Row: {
          created_at: string
          id: string
          read_at: string | null
          schedule_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          read_at?: string | null
          schedule_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          read_at?: string | null
          schedule_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_notifications_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          details: Json | null
          id: string
          message: string
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          time_entry_id: string | null
          user_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          message: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          time_entry_id?: string | null
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          message?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          time_entry_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_alerts_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      session_limits: {
        Row: {
          auto_logout_oldest: boolean
          created_at: string | null
          id: string
          max_concurrent_sessions: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_logout_oldest?: boolean
          created_at?: string | null
          id?: string
          max_concurrent_sessions?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_logout_oldest?: boolean
          created_at?: string | null
          id?: string
          max_concurrent_sessions?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tardiness_reports: {
        Row: {
          actual_clock_in_time: string
          admin_notes: string | null
          created_at: string | null
          delay_minutes: number
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_start_time: string
          status: string
          time_entry_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_clock_in_time: string
          admin_notes?: string | null
          created_at?: string | null
          delay_minutes: number
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_start_time: string
          status?: string
          time_entry_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_clock_in_time?: string
          admin_notes?: string | null
          created_at?: string | null
          delay_minutes?: number
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_start_time?: string
          status?: string
          time_entry_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tardiness_reports_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          clock_in_latitude: number | null
          clock_in_location_id: string | null
          clock_in_longitude: number | null
          clock_in_photo_url: string | null
          clock_in_time: string
          clock_out_latitude: number | null
          clock_out_location_id: string | null
          clock_out_longitude: number | null
          clock_out_photo_url: string | null
          clock_out_time: string | null
          created_at: string | null
          device_id: string | null
          device_info: Json | null
          id: string
          ip_address: string | null
          last_reprocess_attempt: string | null
          needs_reprocessing: boolean | null
          notes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          clock_in_latitude?: number | null
          clock_in_location_id?: string | null
          clock_in_longitude?: number | null
          clock_in_photo_url?: string | null
          clock_in_time: string
          clock_out_latitude?: number | null
          clock_out_location_id?: string | null
          clock_out_longitude?: number | null
          clock_out_photo_url?: string | null
          clock_out_time?: string | null
          created_at?: string | null
          device_id?: string | null
          device_info?: Json | null
          id?: string
          ip_address?: string | null
          last_reprocess_attempt?: string | null
          needs_reprocessing?: boolean | null
          notes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          clock_in_latitude?: number | null
          clock_in_location_id?: string | null
          clock_in_longitude?: number | null
          clock_in_photo_url?: string | null
          clock_in_time?: string
          clock_out_latitude?: number | null
          clock_out_location_id?: string | null
          clock_out_longitude?: number | null
          clock_out_photo_url?: string | null
          clock_out_time?: string | null
          created_at?: string | null
          device_id?: string | null
          device_info?: Json | null
          id?: string
          ip_address?: string | null
          last_reprocess_attempt?: string | null
          needs_reprocessing?: boolean | null
          notes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_clock_in_location_id_fkey"
            columns: ["clock_in_location_id"]
            isOneToOne: false
            referencedRelation: "work_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_clock_out_location_id_fkey"
            columns: ["clock_out_location_id"]
            isOneToOne: false
            referencedRelation: "work_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_correction_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          current_entry_id: string | null
          description: string
          id: string
          proposed_clock_in: string | null
          proposed_clock_out: string | null
          proposed_shift_type: string | null
          request_type: Database["public"]["Enums"]["correction_request_type"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          current_entry_id?: string | null
          description: string
          id?: string
          proposed_clock_in?: string | null
          proposed_clock_out?: string | null
          proposed_shift_type?: string | null
          request_type: Database["public"]["Enums"]["correction_request_type"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          current_entry_id?: string | null
          description?: string
          id?: string
          proposed_clock_in?: string | null
          proposed_clock_out?: string | null
          proposed_shift_type?: string | null
          request_type?: Database["public"]["Enums"]["correction_request_type"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_correction_requests_current_entry_id_fkey"
            columns: ["current_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_segments: {
        Row: {
          created_at: string | null
          end_time: string
          hours_decimal: number
          id: string
          multiplier: number
          segment_type: string
          start_time: string
          time_entry_id: string
        }
        Insert: {
          created_at?: string | null
          end_time: string
          hours_decimal: number
          id?: string
          multiplier?: number
          segment_type: string
          start_time: string
          time_entry_id: string
        }
        Update: {
          created_at?: string | null
          end_time?: string
          hours_decimal?: number
          id?: string
          multiplier?: number
          segment_type?: string
          start_time?: string
          time_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_segments_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consents: {
        Row: {
          consent_date: string | null
          consent_given: boolean
          consent_type: string
          consent_withdrawn_date: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_date?: string | null
          consent_given?: boolean
          consent_type: string
          consent_withdrawn_date?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_date?: string | null
          consent_given?: boolean
          consent_type?: string
          consent_withdrawn_date?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_password_tracking: {
        Row: {
          created_at: string | null
          id: string
          is_default_password: boolean | null
          must_change_password: boolean | null
          password_changed_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default_password?: boolean | null
          must_change_password?: boolean | null
          password_changed_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default_password?: boolean | null
          must_change_password?: boolean | null
          password_changed_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vacation_requests: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          days_count: number
          end_date: string
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          days_count: number
          end_date: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          days_count?: number
          end_date?: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      weekly_schedules: {
        Row: {
          activity: string | null
          coordinator_id: string | null
          created_at: string
          created_by: string | null
          day_of_week: number
          id: string
          location: string | null
          observations: string | null
          shift_type: string
          team_id: string
          updated_at: string
          user_id: string
          vehicle: string | null
          week_start_date: string
        }
        Insert: {
          activity?: string | null
          coordinator_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_week: number
          id?: string
          location?: string | null
          observations?: string | null
          shift_type?: string
          team_id: string
          updated_at?: string
          user_id: string
          vehicle?: string | null
          week_start_date: string
        }
        Update: {
          activity?: string | null
          coordinator_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          id?: string
          location?: string | null
          observations?: string | null
          shift_type?: string
          team_id?: string
          updated_at?: string
          user_id?: string
          vehicle?: string | null
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_schedules_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_hour_rules: {
        Row: {
          applies_to_days: number[]
          applies_to_holidays: boolean | null
          applies_to_weekends: boolean | null
          created_at: string | null
          description: string | null
          end_time: string
          id: string
          multiplier: number | null
          rule_type: Database["public"]["Enums"]["work_hour_type"]
          start_time: string
          updated_at: string | null
        }
        Insert: {
          applies_to_days?: number[]
          applies_to_holidays?: boolean | null
          applies_to_weekends?: boolean | null
          created_at?: string | null
          description?: string | null
          end_time: string
          id?: string
          multiplier?: number | null
          rule_type: Database["public"]["Enums"]["work_hour_type"]
          start_time: string
          updated_at?: string | null
        }
        Update: {
          applies_to_days?: number[]
          applies_to_holidays?: boolean | null
          applies_to_weekends?: boolean | null
          created_at?: string | null
          description?: string | null
          end_time?: string
          id?: string
          multiplier?: number | null
          rule_type?: Database["public"]["Enums"]["work_hour_type"]
          start_time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      work_locations: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          name: string
          radius_meters: number
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          name: string
          radius_meters?: number
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string
          radius_meters?: number
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      mv_daily_stats: {
        Row: {
          entries_count: number | null
          total_hours: number | null
          user_id: string | null
          work_date: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_biometric_consent: {
        Args: { _user_id: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: { _attempt_type: string; _identifier: string }
        Returns: Json
      }
      check_session_limit: {
        Args: {
          _device_fingerprint: string
          _session_id: string
          _user_id: string
        }
        Returns: Json
      }
      cleanup_expired_sessions: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_sessions_enhanced: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_old_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_sensitive_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      enforce_data_retention: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_cached: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invalidate_user_sessions: {
        Args: { _reason: string; _user_id: string }
        Returns: number
      }
      log_client_error: {
        Args: {
          _action: string
          _details?: Json
          _resource_id: string
          _resource_type: string
        }
        Returns: undefined
      }
      log_sensitive_data_access: {
        Args: {
          _action: string
          _details?: Json
          _resource_id: string
          _resource_type: string
        }
        Returns: undefined
      }
      refresh_daily_stats: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      user_in_team: {
        Args: { _team_id: string; _user_id: string; _week_start: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee"
      correction_request_type:
        | "forgot_clock_in"
        | "forgot_clock_out"
        | "wrong_time"
        | "wrong_shift_type"
        | "duplicate_entry"
        | "other"
      work_hour_type: "normal" | "night" | "saturday" | "sunday_holiday"
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
      app_role: ["admin", "employee"],
      correction_request_type: [
        "forgot_clock_in",
        "forgot_clock_out",
        "wrong_time",
        "wrong_shift_type",
        "duplicate_entry",
        "other",
      ],
      work_hour_type: ["normal", "night", "saturday", "sunday_holiday"],
    },
  },
} as const
