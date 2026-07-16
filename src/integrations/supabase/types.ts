export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      app_settings: {
        Row: {
          default_stream_id: string | null;
          id: number;
          updated_at: string;
        };
        Insert: {
          default_stream_id?: string | null;
          id?: number;
          updated_at?: string;
        };
        Update: {
          default_stream_id?: string | null;
          id?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      channels: {
        Row: {
          category: string;
          direct_url: string | null;
          epg_channel_id: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          stream_id: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          direct_url?: string | null;
          epg_channel_id?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          stream_id: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          direct_url?: string | null;
          epg_channel_id?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          stream_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      favorites: {
        Row: {
          created_at: string;
          id: string;
          team_code: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          team_code: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          team_code?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_team_code_fkey";
            columns: ["team_code"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["code"];
          },
        ];
      };
      match_score_snapshots: {
        Row: {
          away_score: number;
          home_score: number;
          match_id: string;
          status: string | null;
          updated_at: string;
        };
        Insert: {
          away_score?: number;
          home_score?: number;
          match_id: string;
          status?: string | null;
          updated_at?: string;
        };
        Update: {
          away_score?: number;
          home_score?: number;
          match_id?: string;
          status?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          away_score: number | null;
          away_team_code: string | null;
          date_utc: string;
          external_id: string | null;
          group: string | null;
          home_score: number | null;
          home_team_code: string | null;
          id: string;
          minute: string | null;
          stage: string;
          status: string;
          updated_at: string;
          venue_id: string | null;
        };
        Insert: {
          away_score?: number | null;
          away_team_code?: string | null;
          date_utc: string;
          external_id?: string | null;
          group?: string | null;
          home_score?: number | null;
          home_team_code?: string | null;
          id?: string;
          minute?: string | null;
          stage: string;
          status?: string;
          updated_at?: string;
          venue_id?: string | null;
        };
        Update: {
          away_score?: number | null;
          away_team_code?: string | null;
          date_utc?: string;
          external_id?: string | null;
          group?: string | null;
          home_score?: number | null;
          home_team_code?: string | null;
          id?: string;
          minute?: string | null;
          stage?: string;
          status?: string;
          updated_at?: string;
          venue_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "matches_away_team_code_fkey";
            columns: ["away_team_code"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "matches_home_team_code_fkey";
            columns: ["home_team_code"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "matches_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      news: {
        Row: {
          created_at: string;
          id: string;
          image_url: string | null;
          published_at: string | null;
          source: string | null;
          summary: string | null;
          title: string;
          url: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          image_url?: string | null;
          published_at?: string | null;
          source?: string | null;
          summary?: string | null;
          title: string;
          url: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          image_url?: string | null;
          published_at?: string | null;
          source?: string | null;
          summary?: string | null;
          title?: string;
          url?: string;
        };
        Relationships: [];
      };
      notification_log: {
        Row: {
          body: string;
          dedupe_key: string;
          id: string;
          match_id: string | null;
          news_id: string | null;
          sent_at: string;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body: string;
          dedupe_key: string;
          id?: string;
          match_id?: string | null;
          news_id?: string | null;
          sent_at?: string;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string;
          dedupe_key?: string;
          id?: string;
          match_id?: string | null;
          news_id?: string | null;
          sent_at?: string;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      predictions: {
        Row: {
          away_score: number;
          created_at: string;
          home_score: number;
          id: string;
          match_id: string;
          points: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          away_score: number;
          created_at?: string;
          home_score: number;
          id?: string;
          match_id: string;
          points?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          away_score?: number;
          created_at?: string;
          home_score?: number;
          id?: string;
          match_id?: string;
          points?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          favorite_club_id: number | null;
          favorite_club_logo: string | null;
          favorite_club_name: string | null;
          id: string;
          notif_match_events: boolean;
          notif_news: boolean;
          onboarded_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          favorite_club_id?: number | null;
          favorite_club_logo?: string | null;
          favorite_club_name?: string | null;
          id: string;
          notif_match_events?: boolean;
          notif_news?: boolean;
          onboarded_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          favorite_club_id?: number | null;
          favorite_club_logo?: string | null;
          favorite_club_name?: string | null;
          id?: string;
          notif_match_events?: boolean;
          notif_news?: boolean;
          onboarded_at?: string | null;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          created_at: string;
          id: string;
          last_seen_at: string;
          platform: Database["public"]["Enums"]["push_platform"];
          token: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_seen_at?: string;
          platform: Database["public"]["Enums"]["push_platform"];
          token: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_seen_at?: string;
          platform?: Database["public"]["Enums"]["push_platform"];
          token?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      scorers: {
        Row: {
          assists: number | null;
          goals: number | null;
          id: string;
          player: string;
          team_code: string | null;
        };
        Insert: {
          assists?: number | null;
          goals?: number | null;
          id?: string;
          player: string;
          team_code?: string | null;
        };
        Update: {
          assists?: number | null;
          goals?: number | null;
          id?: string;
          player?: string;
          team_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "scorers_team_code_fkey";
            columns: ["team_code"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["code"];
          },
        ];
      };
      scrape_runs: {
        Row: {
          detail: string | null;
          last_run_at: string;
          source: string;
          status: string | null;
        };
        Insert: {
          detail?: string | null;
          last_run_at?: string;
          source: string;
          status?: string | null;
        };
        Update: {
          detail?: string | null;
          last_run_at?: string;
          source?: string;
          status?: string | null;
        };
        Relationships: [];
      };
      standings: {
        Row: {
          d: number | null;
          ga: number | null;
          gd: number | null;
          gf: number | null;
          group: string;
          id: string;
          l: number | null;
          played: number | null;
          pts: number | null;
          team_code: string;
          w: number | null;
        };
        Insert: {
          d?: number | null;
          ga?: number | null;
          gd?: number | null;
          gf?: number | null;
          group: string;
          id?: string;
          l?: number | null;
          played?: number | null;
          pts?: number | null;
          team_code: string;
          w?: number | null;
        };
        Update: {
          d?: number | null;
          ga?: number | null;
          gd?: number | null;
          gf?: number | null;
          group?: string;
          id?: string;
          l?: number | null;
          played?: number | null;
          pts?: number | null;
          team_code?: string;
          w?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "standings_team_code_fkey";
            columns: ["team_code"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["code"];
          },
        ];
      };
      teams: {
        Row: {
          code: string;
          confederation: string | null;
          created_at: string;
          flag_url: string | null;
          group: string | null;
          id: string;
          name: string;
        };
        Insert: {
          code: string;
          confederation?: string | null;
          created_at?: string;
          flag_url?: string | null;
          group?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          code?: string;
          confederation?: string | null;
          created_at?: string;
          flag_url?: string | null;
          group?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      venues: {
        Row: {
          capacity: number | null;
          city: string;
          country: string;
          created_at: string;
          id: string;
          image_url: string | null;
          name: string;
        };
        Insert: {
          capacity?: number | null;
          city: string;
          country: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          name: string;
        };
        Update: {
          capacity?: number | null;
          city?: string;
          country?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          name?: string;
        };
        Relationships: [];
      };
      xtream_config: {
        Row: {
          host: string;
          id: number;
          password: string;
          updated_at: string;
          username: string;
        };
        Insert: {
          host: string;
          id?: number;
          password: string;
          updated_at?: string;
          username: string;
        };
        Update: {
          host?: string;
          id?: number;
          password?: string;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      upsert_push_token: {
        Args: {
          p_token: string;
          p_platform: Database["public"]["Enums"]["push_platform"];
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin" | "user";
      push_platform: "web" | "android" | "ios";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      push_platform: ["web", "android", "ios"],
    },
  },
} as const;
