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
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee"
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
      work_hour_type: ["normal", "night", "saturday", "sunday_holiday"],
    },
  },
} as const
