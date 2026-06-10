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
      players: {
        Row: {
          answered_count: number
          avatar_url: string | null
          best_streak: number
          comeback_bonus: boolean
          correct_count: number
          created_at: string
          current_answer: number | null
          current_answer_locked_at: string | null
          current_first_answer: number | null
          current_round_fastest: boolean
          current_round_score: number
          fastest_count: number
          final_answer: number | null
          final_locked_at: string | null
          final_wager: number
          funny_sound_id: string | null
          id: string
          is_audience: boolean
          last_answer_correct: boolean | null
          last_seen_at: string
          nickname: string
          pending_2x: boolean
          room_id: string
          score: number
          session_id: string
          streak_count: number
          team: string | null
          total_response_ms: number
          used_2x: boolean
          wrong_count: number
        }
        Insert: {
          answered_count?: number
          avatar_url?: string | null
          best_streak?: number
          comeback_bonus?: boolean
          correct_count?: number
          created_at?: string
          current_answer?: number | null
          current_answer_locked_at?: string | null
          current_first_answer?: number | null
          current_round_fastest?: boolean
          current_round_score?: number
          fastest_count?: number
          final_answer?: number | null
          final_locked_at?: string | null
          final_wager?: number
          funny_sound_id?: string | null
          id?: string
          is_audience?: boolean
          last_answer_correct?: boolean | null
          last_seen_at?: string
          nickname: string
          pending_2x?: boolean
          room_id: string
          score?: number
          session_id: string
          streak_count?: number
          team?: string | null
          total_response_ms?: number
          used_2x?: boolean
          wrong_count?: number
        }
        Update: {
          answered_count?: number
          avatar_url?: string | null
          best_streak?: number
          comeback_bonus?: boolean
          correct_count?: number
          created_at?: string
          current_answer?: number | null
          current_answer_locked_at?: string | null
          current_first_answer?: number | null
          current_round_fastest?: boolean
          current_round_score?: number
          fastest_count?: number
          final_answer?: number | null
          final_locked_at?: string | null
          final_wager?: number
          funny_sound_id?: string | null
          id?: string
          is_audience?: boolean
          last_answer_correct?: boolean | null
          last_seen_at?: string
          nickname?: string
          pending_2x?: boolean
          room_id?: string
          score?: number
          session_id?: string
          streak_count?: number
          team?: string | null
          total_response_ms?: number
          used_2x?: boolean
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          is_premium: boolean
          premium_until: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          is_premium?: boolean
          premium_until?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          is_premium?: boolean
          premium_until?: string | null
          user_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          category: string
          correct_answer: string
          created_at: string
          difficulty: string
          explanation: string | null
          explanation_tts_path: string | null
          explanation_tts_text_hash: string | null
          id: string
          is_premium: boolean
          last_used_at: string | null
          media_type: string | null
          media_url: string | null
          question_text: string
          subcategory: string | null
          times_answered: number
          times_correct: number
          times_used: number
          total_response_ms: number
          tts_path: string | null
          tts_text_hash: string | null
          wrong_1: string
          wrong_2: string
          wrong_3: string
        }
        Insert: {
          category: string
          correct_answer: string
          created_at?: string
          difficulty?: string
          explanation?: string | null
          explanation_tts_path?: string | null
          explanation_tts_text_hash?: string | null
          id?: string
          is_premium?: boolean
          last_used_at?: string | null
          media_type?: string | null
          media_url?: string | null
          question_text: string
          subcategory?: string | null
          times_answered?: number
          times_correct?: number
          times_used?: number
          total_response_ms?: number
          tts_path?: string | null
          tts_text_hash?: string | null
          wrong_1: string
          wrong_2: string
          wrong_3: string
        }
        Update: {
          category?: string
          correct_answer?: string
          created_at?: string
          difficulty?: string
          explanation?: string | null
          explanation_tts_path?: string | null
          explanation_tts_text_hash?: string | null
          id?: string
          is_premium?: boolean
          last_used_at?: string | null
          media_type?: string | null
          media_url?: string | null
          question_text?: string
          subcategory?: string | null
          times_answered?: number
          times_correct?: number
          times_used?: number
          total_response_ms?: number
          tts_path?: string | null
          tts_text_hash?: string | null
          wrong_1?: string
          wrong_2?: string
          wrong_3?: string
        }
        Relationships: []
      }
      room_questions: {
        Row: {
          asked_at: string
          question_id: string
          room_id: string
        }
        Insert: {
          asked_at?: string
          question_id: string
          room_id: string
        }
        Update: {
          asked_at?: string
          question_id?: string
          room_id?: string
        }
        Relationships: []
      }
      room_secrets: {
        Row: {
          correct_index: number | null
          room_id: string
          updated_at: string
        }
        Insert: {
          correct_index?: number | null
          room_id: string
          updated_at?: string
        }
        Update: {
          correct_index?: number | null
          room_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_secrets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          allow_late_joiners: boolean
          created_at: string
          current_answers: string[] | null
          current_category: string | null
          current_correct_index: number | null
          current_explanation: string | null
          current_explanation_tts_url: string | null
          current_media_type: string | null
          current_media_url: string | null
          current_question_id: string | null
          current_question_text: string | null
          current_question_tts_url: string | null
          difficulty_mode: string | null
          dropped_indexes: number[]
          enabled_categories: string[] | null
          glitch_active_until: string | null
          glitch_used: boolean
          host_last_seen_at: string
          host_session_id: string
          id: string
          is_paused: boolean
          phase: string
          question_duration_ms: number
          question_started_at: string | null
          roast_candidates: Json | null
          room_code: string
          round_number: number
          saboteur_session_id: string | null
          status: string
          sudden_death_session_ids: string[]
          team_mode: boolean
          theme: string
          tts_calls_count: number
          tts_cap_started_at: string | null
          wildcard: string | null
        }
        Insert: {
          allow_late_joiners?: boolean
          created_at?: string
          current_answers?: string[] | null
          current_category?: string | null
          current_correct_index?: number | null
          current_explanation?: string | null
          current_explanation_tts_url?: string | null
          current_media_type?: string | null
          current_media_url?: string | null
          current_question_id?: string | null
          current_question_text?: string | null
          current_question_tts_url?: string | null
          difficulty_mode?: string | null
          dropped_indexes?: number[]
          enabled_categories?: string[] | null
          glitch_active_until?: string | null
          glitch_used?: boolean
          host_last_seen_at?: string
          host_session_id: string
          id?: string
          is_paused?: boolean
          phase?: string
          question_duration_ms?: number
          question_started_at?: string | null
          roast_candidates?: Json | null
          room_code: string
          round_number?: number
          saboteur_session_id?: string | null
          status?: string
          sudden_death_session_ids?: string[]
          team_mode?: boolean
          theme?: string
          tts_calls_count?: number
          tts_cap_started_at?: string | null
          wildcard?: string | null
        }
        Update: {
          allow_late_joiners?: boolean
          created_at?: string
          current_answers?: string[] | null
          current_category?: string | null
          current_correct_index?: number | null
          current_explanation?: string | null
          current_explanation_tts_url?: string | null
          current_media_type?: string | null
          current_media_url?: string | null
          current_question_id?: string | null
          current_question_text?: string | null
          current_question_tts_url?: string | null
          difficulty_mode?: string | null
          dropped_indexes?: number[]
          enabled_categories?: string[] | null
          glitch_active_until?: string | null
          glitch_used?: boolean
          host_last_seen_at?: string
          host_session_id?: string
          id?: string
          is_paused?: boolean
          phase?: string
          question_duration_ms?: number
          question_started_at?: string | null
          roast_candidates?: Json | null
          room_code?: string
          round_number?: number
          saboteur_session_id?: string | null
          status?: string
          sudden_death_session_ids?: string[]
          team_mode?: boolean
          theme?: string
          tts_calls_count?: number
          tts_cap_started_at?: string | null
          wildcard?: string | null
        }
        Relationships: []
      }
      sound_clips: {
        Row: {
          audience_visible: boolean
          category: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          loop: boolean
          original_filename: string | null
          slot: string
          storage_path: string
          volume: number
        }
        Insert: {
          audience_visible?: boolean
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          loop?: boolean
          original_filename?: string | null
          slot: string
          storage_path: string
          volume?: number
        }
        Update: {
          audience_visible?: boolean
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          loop?: boolean
          original_filename?: string | null
          slot?: string
          storage_path?: string
          volume?: number
        }
        Relationships: []
      }
      sound_event_assignments: {
        Row: {
          clip_id: string | null
          event: string
          loop: boolean
          updated_at: string
          volume: number
        }
        Insert: {
          clip_id?: string | null
          event: string
          loop?: boolean
          updated_at?: string
          volume?: number
        }
        Update: {
          clip_id?: string | null
          event?: string
          loop?: boolean
          updated_at?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "sound_event_assignments_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "sound_clips"
            referencedColumns: ["id"]
          },
        ]
      }
      sound_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      tts_cache: {
        Row: {
          created_at: string
          hit_count: number
          last_used_at: string
          preset: string
          storage_path: string
          text: string
          text_hash: string
        }
        Insert: {
          created_at?: string
          hit_count?: number
          last_used_at?: string
          preset: string
          storage_path: string
          text: string
          text_hash: string
        }
        Update: {
          created_at?: string
          hit_count?: number
          last_used_at?: string
          preset?: string
          storage_path?: string
          text?: string
          text_hash?: string
        }
        Relationships: []
      }
      tts_call_log: {
        Row: {
          char_count: number
          created_at: string
          id: string
          outcome: string
          preset: string
          room_id: string | null
          text_hash: string
        }
        Insert: {
          char_count?: number
          created_at?: string
          id?: string
          outcome: string
          preset: string
          room_id?: string | null
          text_hash: string
        }
        Update: {
          char_count?: number
          created_at?: string
          id?: string
          outcome?: string
          preset?: string
          room_id?: string | null
          text_hash?: string
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
      list_question_categories: {
        Args: never
        Returns: {
          count: number
          name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
