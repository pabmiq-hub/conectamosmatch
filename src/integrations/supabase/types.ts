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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bulletin_posts: {
        Row: {
          author_id: string | null
          content: string
          created_at: string | null
          event_id: string | null
          id: string
          scope: Database["public"]["Enums"]["bulletin_scope_t"]
          title: string | null
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          scope?: Database["public"]["Enums"]["bulletin_scope_t"]
          title?: string | null
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          scope?: Database["public"]["Enums"]["bulletin_scope_t"]
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulletin_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_profiles: {
        Row: {
          company_name: string
          company_size: Database["public"]["Enums"]["company_size_t"] | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          id: string
          instagram_url: string | null
          is_verified: boolean | null
          linkedin_url: string | null
          location_city: string | null
          location_country: string | null
          logo_url: string | null
          looking_for: string | null
          profile_completion: number | null
          responsables: Json
          sector: string | null
          tagline: string | null
          tags: string[] | null
          twitter_url: string | null
          updated_at: string | null
          user_id: string | null
          website: string | null
        }
        Insert: {
          company_name: string
          company_size?: Database["public"]["Enums"]["company_size_t"] | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          instagram_url?: string | null
          is_verified?: boolean | null
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          logo_url?: string | null
          looking_for?: string | null
          profile_completion?: number | null
          responsables?: Json
          sector?: string | null
          tagline?: string | null
          tags?: string[] | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id?: string | null
          website?: string | null
        }
        Update: {
          company_name?: string
          company_size?: Database["public"]["Enums"]["company_size_t"] | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          instagram_url?: string | null
          is_verified?: boolean | null
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          logo_url?: string | null
          looking_for?: string | null
          profile_completion?: number | null
          responsables?: Json
          sector?: string | null
          tagline?: string | null
          tags?: string[] | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_agenda: {
        Row: {
          agenda_type: Database["public"]["Enums"]["agenda_type_t"] | null
          created_at: string | null
          description: string | null
          event_date: string | null
          event_id: string | null
          id: string
          order_index: number | null
          room: string | null
          speaker_name: string | null
          speaker_role: string | null
          time_end: string | null
          time_start: string | null
          title: string
        }
        Insert: {
          agenda_type?: Database["public"]["Enums"]["agenda_type_t"] | null
          created_at?: string | null
          description?: string | null
          event_date?: string | null
          event_id?: string | null
          id?: string
          order_index?: number | null
          room?: string | null
          speaker_name?: string | null
          speaker_role?: string | null
          time_end?: string | null
          time_start?: string | null
          title: string
        }
        Update: {
          agenda_type?: Database["public"]["Enums"]["agenda_type_t"] | null
          created_at?: string | null
          description?: string | null
          event_date?: string | null
          event_id?: string | null
          id?: string
          order_index?: number | null
          room?: string | null
          speaker_name?: string | null
          speaker_role?: string | null
          time_end?: string | null
          time_start?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_agenda_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          attendee_company: string | null
          attendee_email: string | null
          attendee_name: string | null
          attendee_role_title: string | null
          checked_in_at: string | null
          event_id: string | null
          id: string
          invitation_code_id: string | null
          registered_at: string | null
          role_at_event: Database["public"]["Enums"]["attendee_role_t"] | null
          status: Database["public"]["Enums"]["registration_status_t"] | null
          user_id: string | null
        }
        Insert: {
          attendee_company?: string | null
          attendee_email?: string | null
          attendee_name?: string | null
          attendee_role_title?: string | null
          checked_in_at?: string | null
          event_id?: string | null
          id?: string
          invitation_code_id?: string | null
          registered_at?: string | null
          role_at_event?: Database["public"]["Enums"]["attendee_role_t"] | null
          status?: Database["public"]["Enums"]["registration_status_t"] | null
          user_id?: string | null
        }
        Update: {
          attendee_company?: string | null
          attendee_email?: string | null
          attendee_name?: string | null
          attendee_role_title?: string | null
          checked_in_at?: string | null
          event_id?: string | null
          id?: string
          invitation_code_id?: string | null
          registered_at?: string | null
          role_at_event?: Database["public"]["Enums"]["attendee_role_t"] | null
          status?: Database["public"]["Enums"]["registration_status_t"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_invitation_code_id_fkey"
            columns: ["invitation_code_id"]
            isOneToOne: false
            referencedRelation: "invitation_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          event_date: string | null
          id: string
          is_active: boolean | null
          is_virtual: boolean | null
          location_address: string | null
          location_city: string | null
          location_name: string | null
          max_empresas: number | null
          max_likes_per_user: number
          max_sponsors: number | null
          meetings_end_at: string | null
          meetings_per_user: number
          meetings_start_at: string | null
          rooms: string[]
          slot_duration_minutes: number
          slug: string | null
          status: Database["public"]["Enums"]["event_status_t"] | null
          title: string
          virtual_url: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_date?: string | null
          id?: string
          is_active?: boolean | null
          is_virtual?: boolean | null
          location_address?: string | null
          location_city?: string | null
          location_name?: string | null
          max_empresas?: number | null
          max_likes_per_user?: number
          max_sponsors?: number | null
          meetings_end_at?: string | null
          meetings_per_user?: number
          meetings_start_at?: string | null
          rooms?: string[]
          slot_duration_minutes?: number
          slug?: string | null
          status?: Database["public"]["Enums"]["event_status_t"] | null
          title: string
          virtual_url?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_date?: string | null
          id?: string
          is_active?: boolean | null
          is_virtual?: boolean | null
          location_address?: string | null
          location_city?: string | null
          location_name?: string | null
          max_empresas?: number | null
          max_likes_per_user?: number
          max_sponsors?: number | null
          meetings_end_at?: string | null
          meetings_per_user?: number
          meetings_start_at?: string | null
          rooms?: string[]
          slot_duration_minutes?: number
          slug?: string | null
          status?: Database["public"]["Enums"]["event_status_t"] | null
          title?: string
          virtual_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_codes: {
        Row: {
          code: string
          created_at: string | null
          event_id: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          sponsor_user_id: string | null
          used_count: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          sponsor_user_id?: string | null
          used_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          sponsor_user_id?: string | null
          used_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_codes_sponsor_user_id_fkey"
            columns: ["sponsor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string | null
          event_id: string | null
          from_user_id: string | null
          id: string
          to_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          from_user_id?: string | null
          id?: string
          to_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          from_user_id?: string | null
          id?: string
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "likes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string | null
          empresa_account_id: string | null
          empresa_user_id: string | null
          event_id: string | null
          id: string
          matched_at: string | null
          sponsor_account_id: string | null
          sponsor_user_id: string | null
          status: Database["public"]["Enums"]["match_status_t"] | null
        }
        Insert: {
          created_at?: string | null
          empresa_account_id?: string | null
          empresa_user_id?: string | null
          event_id?: string | null
          id?: string
          matched_at?: string | null
          sponsor_account_id?: string | null
          sponsor_user_id?: string | null
          status?: Database["public"]["Enums"]["match_status_t"] | null
        }
        Update: {
          created_at?: string | null
          empresa_account_id?: string | null
          empresa_user_id?: string | null
          event_id?: string | null
          id?: string
          matched_at?: string | null
          sponsor_account_id?: string | null
          sponsor_user_id?: string | null
          status?: Database["public"]["Enums"]["match_status_t"] | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_empresa_user_id_fkey"
            columns: ["empresa_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_sponsor_user_id_fkey"
            columns: ["sponsor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings_1to1: {
        Row: {
          assigned_by: string | null
          bloque: string | null
          created_at: string | null
          duration_minutes: number | null
          empresa_account_id: string | null
          empresa_responsable: Json | null
          empresa_user_id: string | null
          event_id: string | null
          id: string
          match_id: string | null
          notes: string | null
          room: string | null
          scheduled_time: string | null
          slot: string | null
          sponsor_account_id: string | null
          sponsor_responsable: Json | null
          sponsor_user_id: string | null
          status: Database["public"]["Enums"]["meeting_status_t"] | null
          tipo_match: string | null
          tipo_sponsor: string | null
        }
        Insert: {
          assigned_by?: string | null
          bloque?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          empresa_account_id?: string | null
          empresa_responsable?: Json | null
          empresa_user_id?: string | null
          event_id?: string | null
          id?: string
          match_id?: string | null
          notes?: string | null
          room?: string | null
          scheduled_time?: string | null
          slot?: string | null
          sponsor_account_id?: string | null
          sponsor_responsable?: Json | null
          sponsor_user_id?: string | null
          status?: Database["public"]["Enums"]["meeting_status_t"] | null
          tipo_match?: string | null
          tipo_sponsor?: string | null
        }
        Update: {
          assigned_by?: string | null
          bloque?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          empresa_account_id?: string | null
          empresa_responsable?: Json | null
          empresa_user_id?: string | null
          event_id?: string | null
          id?: string
          match_id?: string | null
          notes?: string | null
          room?: string | null
          scheduled_time?: string | null
          slot?: string | null
          sponsor_account_id?: string | null
          sponsor_responsable?: Json | null
          sponsor_user_id?: string | null
          status?: Database["public"]["Enums"]["meeting_status_t"] | null
          tipo_match?: string | null
          tipo_sponsor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_1to1_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_1to1_empresa_user_id_fkey"
            columns: ["empresa_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_1to1_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_1to1_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_1to1_sponsor_user_id_fkey"
            columns: ["sponsor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_id: string | null
          account_role: string
          avatar_url: string | null
          cargo: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          account_role?: string
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          account_role?: string
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      responsable_requests: {
        Row: {
          account_id: string
          account_type: string
          cargo: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          rejection_reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["responsable_request_status_t"]
        }
        Insert: {
          account_id: string
          account_type: string
          cargo?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          rejection_reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["responsable_request_status_t"]
        }
        Update: {
          account_id?: string
          account_type?: string
          cargo?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          rejection_reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["responsable_request_status_t"]
        }
        Relationships: []
      }
      reto_config: {
        Row: {
          closes_at: string | null
          created_at: string
          emergency_off: boolean
          event_id: string
          is_active: boolean
          is_closed: boolean
          missions_recalc_at: string | null
          target: number
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          emergency_off?: boolean
          event_id: string
          is_active?: boolean
          is_closed?: boolean
          missions_recalc_at?: string | null
          target?: number
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          emergency_off?: boolean
          event_id?: string
          is_active?: boolean
          is_closed?: boolean
          missions_recalc_at?: string | null
          target?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reto_config_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      reto_intro_claims: {
        Row: {
          claimed_at: string
          event_id: string
          introducer_id: string
          introduction_id: string
          person_a: string
          person_b: string
        }
        Insert: {
          claimed_at?: string
          event_id: string
          introducer_id: string
          introduction_id: string
          person_a: string
          person_b: string
        }
        Update: {
          claimed_at?: string
          event_id?: string
          introducer_id?: string
          introduction_id?: string
          person_a?: string
          person_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "reto_intro_claims_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reto_intro_claims_introduction_id_fkey"
            columns: ["introduction_id"]
            isOneToOne: false
            referencedRelation: "reto_introductions"
            referencedColumns: ["id"]
          },
        ]
      }
      reto_introductions: {
        Row: {
          a_confirmed_at: string | null
          b_confirmed_at: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          event_id: string
          id: string
          introducer_id: string
          person_a: string
          person_b: string
          status: string
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          a_confirmed_at?: string | null
          b_confirmed_at?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          event_id: string
          id?: string
          introducer_id: string
          person_a: string
          person_b: string
          status?: string
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          a_confirmed_at?: string | null
          b_confirmed_at?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          event_id?: string
          id?: string
          introducer_id?: string
          person_a?: string
          person_b?: string
          status?: string
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reto_introductions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reto_introductions_introducer_id_fkey"
            columns: ["introducer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reto_introductions_person_a_fkey"
            columns: ["person_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reto_introductions_person_b_fkey"
            columns: ["person_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reto_marks: {
        Row: {
          created_at: string
          event_id: string
          from_user_id: string
          id: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          from_user_id: string
          id?: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          from_user_id?: string
          id?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reto_marks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reto_marks_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reto_marks_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reto_mission_awards: {
        Row: {
          award_index: number
          awarded_at: string
          event_id: string
          id: string
          introduction_id: string | null
          mission_id: string
          points: number
          user_id: string
        }
        Insert: {
          award_index?: number
          awarded_at?: string
          event_id: string
          id?: string
          introduction_id?: string | null
          mission_id: string
          points: number
          user_id: string
        }
        Update: {
          award_index?: number
          awarded_at?: string
          event_id?: string
          id?: string
          introduction_id?: string | null
          mission_id?: string
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reto_mission_awards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reto_mission_awards_introduction_id_fkey"
            columns: ["introduction_id"]
            isOneToOne: false
            referencedRelation: "reto_introductions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reto_mission_awards_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "reto_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reto_mission_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reto_missions: {
        Row: {
          bonus_points: number
          code: string
          created_at: string
          description: string | null
          enabled: boolean
          event_id: string
          id: string
          max_awards: number
          order_index: number
          starts_at: string | null
          status: string
          threshold: number
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          bonus_points?: number
          code: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          event_id: string
          id?: string
          max_awards?: number
          order_index?: number
          starts_at?: string | null
          status?: string
          threshold?: number
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          bonus_points?: number
          code?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          event_id?: string
          id?: string
          max_awards?: number
          order_index?: number
          starts_at?: string | null
          status?: string
          threshold?: number
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reto_missions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      reto_participants: {
        Row: {
          account_id: string | null
          cargo: string | null
          company_name: string | null
          created_at: string
          display_name: string
          event_id: string
          id: string
          participant_type: string
          photo_url: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          cargo?: string | null
          company_name?: string | null
          created_at?: string
          display_name: string
          event_id: string
          id?: string
          participant_type: string
          photo_url?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          cargo?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string
          event_id?: string
          id?: string
          participant_type?: string
          photo_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reto_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reto_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reto_points_log: {
        Row: {
          created_at: string
          delta: number
          detail: string | null
          event_id: string
          id: string
          mission_code: string | null
          mission_id: string | null
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          detail?: string | null
          event_id: string
          id?: string
          mission_code?: string | null
          mission_id?: string | null
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          detail?: string | null
          event_id?: string
          id?: string
          mission_code?: string | null
          mission_id?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reto_points_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reto_points_log_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "reto_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reto_points_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_profiles: {
        Row: {
          budget_range: string | null
          categories: string[] | null
          company_name: string
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          id: string
          is_verified: boolean | null
          linkedin_url: string | null
          location_city: string | null
          logo_url: string | null
          native_integrations: string[] | null
          profile_completion: number | null
          responsables: Json
          sector: string | null
          sponsorship_category: string | null
          sponsorship_level: string | null
          tagline: string | null
          target_audience: string | null
          twitter_url: string | null
          updated_at: string | null
          user_id: string | null
          website: string | null
        }
        Insert: {
          budget_range?: string | null
          categories?: string[] | null
          company_name: string
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_verified?: boolean | null
          linkedin_url?: string | null
          location_city?: string | null
          logo_url?: string | null
          native_integrations?: string[] | null
          profile_completion?: number | null
          responsables?: Json
          sector?: string | null
          sponsorship_category?: string | null
          sponsorship_level?: string | null
          tagline?: string | null
          target_audience?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id?: string | null
          website?: string | null
        }
        Update: {
          budget_range?: string | null
          categories?: string[] | null
          company_name?: string
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_verified?: boolean | null
          linkedin_url?: string | null
          location_city?: string | null
          logo_url?: string | null
          native_integrations?: string[] | null
          profile_completion?: number | null
          responsables?: Json
          sector?: string | null
          sponsorship_category?: string | null
          sponsorship_level?: string | null
          tagline?: string | null
          target_audience?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_id_of: { Args: { _user: string }; Returns: string }
      assign_meeting_slots: {
        Args: { p_event_id: string }
        Returns: {
          assigned: number
          skipped: number
        }[]
      }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_account_id: { Args: never; Returns: string }
      reto_cancel_introduction: { Args: { _id: string }; Returns: undefined }
      reto_connection_count: { Args: { _event: string }; Returns: number }
      reto_create_introduction: {
        Args: { _event: string; _p1: string; _p2: string }
        Returns: string
      }
      reto_is_open: { Args: { _event: string }; Returns: boolean }
      reto_is_participant: {
        Args: { _event: string; _user: string }
        Returns: boolean
      }
      reto_mission_progress_for: {
        Args: { _event: string; _user: string }
        Returns: {
          blocked_reason: string
          eligible: boolean
          mission_id: string
          progress: number
          unlocked: boolean
        }[]
      }
      reto_my_introductions: {
        Args: { _event: string }
        Returns: {
          a_confirmed: boolean
          awarded: boolean
          b_confirmed: boolean
          created_at: string
          id: string
          introducer_id: string
          pair_connected: boolean
          person_a: string
          person_b: string
          status: string
          validated_at: string
        }[]
      }
      reto_my_missions: {
        Args: { _event: string }
        Returns: {
          awarded_count: number
          awarded_points: number
          blocked_reason: string
          bonus_points: number
          code: string
          description: string
          enabled: boolean
          max_awards: number
          mission_id: string
          order_index: number
          progress: number
          starts_at: string
          status: string
          threshold: number
          title: string
          type: string
          unlocked: boolean
        }[]
      }
      reto_pair_connected: {
        Args: { _a: string; _b: string; _event: string }
        Returns: boolean
      }
      reto_recalc_event: { Args: { _event: string }; Returns: number }
      reto_recalc_event_internal: { Args: { _event: string }; Returns: number }
      reto_recalc_intros: {
        Args: { _event: string; _introducer: string }
        Returns: undefined
      }
      reto_recalc_user: {
        Args: { _event: string; _user: string }
        Returns: undefined
      }
      reto_refresh_missions: { Args: { _event: string }; Returns: undefined }
      reto_respond_introduction: {
        Args: { _action: string; _id: string }
        Returns: string
      }
      reto_scoreboard: {
        Args: { _event: string }
        Returns: {
          bonus: number
          company_name: string
          connections: number
          display_name: string
          participant_type: string
          photo_url: string
          points: number
          user_id: string
        }[]
      }
      reto_seed_default_missions: {
        Args: { _event: string }
        Returns: undefined
      }
      same_account: { Args: { _a: string; _b: string }; Returns: boolean }
    }
    Enums: {
      agenda_type_t:
        | "bienvenida"
        | "charla"
        | "networking"
        | "coffee_break"
        | "comida"
        | "reuniones_1to1"
        | "cierre"
        | "panel"
      app_role: "super_admin" | "empresa" | "sponsor"
      attendee_role_t: "empresa" | "sponsor"
      bulletin_scope_t: "global" | "event"
      company_size_t: "1-10" | "11-50" | "51-200" | "201-500" | "500+"
      event_status_t:
        | "draft"
        | "published"
        | "ongoing"
        | "finished"
        | "cancelled"
      match_status_t: "mutual" | "pending"
      meeting_status_t: "pending" | "confirmed" | "completed" | "cancelled"
      registration_status_t:
        | "registered"
        | "confirmed"
        | "attended"
        | "cancelled"
      responsable_request_status_t:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
      sponsor_level_t:
        | "PLATINUM"
        | "GOLD"
        | "SILVER"
        | "BRONZE"
        | "PREMIUM"
        | "BASIC"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      agenda_type_t: [
        "bienvenida",
        "charla",
        "networking",
        "coffee_break",
        "comida",
        "reuniones_1to1",
        "cierre",
        "panel",
      ],
      app_role: ["super_admin", "empresa", "sponsor"],
      attendee_role_t: ["empresa", "sponsor"],
      bulletin_scope_t: ["global", "event"],
      company_size_t: ["1-10", "11-50", "51-200", "201-500", "500+"],
      event_status_t: [
        "draft",
        "published",
        "ongoing",
        "finished",
        "cancelled",
      ],
      match_status_t: ["mutual", "pending"],
      meeting_status_t: ["pending", "confirmed", "completed", "cancelled"],
      registration_status_t: [
        "registered",
        "confirmed",
        "attended",
        "cancelled",
      ],
      responsable_request_status_t: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
      ],
      sponsor_level_t: [
        "PLATINUM",
        "GOLD",
        "SILVER",
        "BRONZE",
        "PREMIUM",
        "BASIC",
      ],
    },
  },
} as const
