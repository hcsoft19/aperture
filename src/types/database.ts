export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
          organization_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
          organization_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
          organization_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      clinic_profiles: {
        Row: {
          address: string;
          allow_indexing: boolean;
          booking_label: string;
          booking_url: string;
          city: string;
          contact_name: string;
          country: string;
          cover_path: string | null;
          display_name: string;
          email: string;
          introduction: string;
          languages: string;
          logo_path: string | null;
          opening_hours: string;
          organization_id: string;
          phone: string;
          postal_code: string;
          published: boolean;
          region: string;
          slug: string;
          social_links: Json;
          specialties: string;
          updated_at: string;
          website: string;
          whatsapp: string;
        };
        Insert: {
          address?: string;
          allow_indexing?: boolean;
          booking_label?: string;
          booking_url?: string;
          city?: string;
          contact_name?: string;
          country?: string;
          cover_path?: string | null;
          display_name: string;
          email?: string;
          introduction?: string;
          languages?: string;
          logo_path?: string | null;
          opening_hours?: string;
          organization_id: string;
          phone?: string;
          postal_code?: string;
          published?: boolean;
          region?: string;
          slug: string;
          social_links?: Json;
          specialties?: string;
          updated_at?: string;
          website?: string;
          whatsapp?: string;
        };
        Update: {
          address?: string;
          allow_indexing?: boolean;
          booking_label?: string;
          booking_url?: string;
          city?: string;
          contact_name?: string;
          country?: string;
          cover_path?: string | null;
          display_name?: string;
          email?: string;
          introduction?: string;
          languages?: string;
          logo_path?: string | null;
          opening_hours?: string;
          organization_id?: string;
          phone?: string;
          postal_code?: string;
          published?: boolean;
          region?: string;
          slug?: string;
          social_links?: Json;
          specialties?: string;
          updated_at?: string;
          website?: string;
          whatsapp?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clinic_profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      clinic_publication_permissions: {
        Row: {
          comparison_id: string;
          confirmed_at: string;
          confirmed_by: string;
          consent_reference: string;
          organization_id: string;
          result_id: string;
          revoked_at: string | null;
        };
        Insert: {
          comparison_id: string;
          confirmed_at?: string;
          confirmed_by: string;
          consent_reference: string;
          organization_id: string;
          result_id: string;
          revoked_at?: string | null;
        };
        Update: {
          comparison_id?: string;
          confirmed_at?: string;
          confirmed_by?: string;
          consent_reference?: string;
          organization_id?: string;
          result_id?: string;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clinic_publication_permissions_comparison_id_fkey";
            columns: ["comparison_id"];
            isOneToOne: false;
            referencedRelation: "comparisons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clinic_publication_permissions_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clinic_publication_permissions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clinic_publication_permissions_result_id_fkey";
            columns: ["result_id"];
            isOneToOne: true;
            referencedRelation: "clinic_showcase_results";
            referencedColumns: ["id"];
          },
        ];
      };
      clinic_showcase_results: {
        Row: {
          after_path: string;
          before_path: string;
          body_area: string;
          category: string;
          created_at: string;
          id: string;
          organization_id: string;
          procedure_type: string;
          published: boolean;
          slug: string;
          summary: string;
          title: string;
          treatment_interval: string;
          updated_at: string;
        };
        Insert: {
          after_path: string;
          before_path: string;
          body_area?: string;
          category: string;
          created_at?: string;
          id: string;
          organization_id: string;
          procedure_type?: string;
          published?: boolean;
          slug: string;
          summary: string;
          title: string;
          treatment_interval?: string;
          updated_at?: string;
        };
        Update: {
          after_path?: string;
          before_path?: string;
          body_area?: string;
          category?: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
          procedure_type?: string;
          published?: boolean;
          slug?: string;
          summary?: string;
          title?: string;
          treatment_interval?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clinic_showcase_results_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "clinic_profiles";
            referencedColumns: ["organization_id"];
          },
        ];
      };
      clinic_slug_reservations: {
        Row: {
          organization_id: string;
          slug: string;
        };
        Insert: {
          organization_id: string;
          slug: string;
        };
        Update: {
          organization_id?: string;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clinic_slug_reservations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "clinic_profiles";
            referencedColumns: ["organization_id"];
          },
        ];
      };
      comparisons: {
        Row: {
          after_photo_id: string;
          alignment: Json;
          before_photo_id: string;
          created_at: string;
          created_by: string;
          id: string;
          revoked_at: string | null;
          shared_at: string | null;
          shared_with_patient: boolean;
          treatment_id: string;
          updated_at: string;
        };
        Insert: {
          after_photo_id: string;
          alignment?: Json;
          before_photo_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          revoked_at?: string | null;
          shared_at?: string | null;
          shared_with_patient?: boolean;
          treatment_id: string;
          updated_at?: string;
        };
        Update: {
          after_photo_id?: string;
          alignment?: Json;
          before_photo_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          revoked_at?: string | null;
          shared_at?: string | null;
          shared_with_patient?: boolean;
          treatment_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comparisons_after_photo_id_fkey";
            columns: ["after_photo_id"];
            isOneToOne: false;
            referencedRelation: "photos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comparisons_before_photo_id_fkey";
            columns: ["before_photo_id"];
            isOneToOne: false;
            referencedRelation: "photos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comparisons_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comparisons_treatment_id_fkey";
            columns: ["treatment_id"];
            isOneToOne: false;
            referencedRelation: "treatments";
            referencedColumns: ["id"];
          },
        ];
      };
      consents: {
        Row: {
          created_at: string;
          granted_at: string;
          granted_by: string | null;
          id: string;
          organization_id: string;
          patient_id: string;
          purpose: string;
          revoked_at: string | null;
        };
        Insert: {
          created_at?: string;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          organization_id: string;
          patient_id: string;
          purpose: string;
          revoked_at?: string | null;
        };
        Update: {
          created_at?: string;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          organization_id?: string;
          patient_id?: string;
          purpose?: string;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "consents_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consents_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consents_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      gallery_demo_cases: {
        Row: {
          after_date: string;
          after_path: string | null;
          before_date: string;
          before_path: string;
          body_area: string;
          category: string;
          created_at: string;
          created_by: string;
          description: string;
          height: number | null;
          id: string;
          organization_id: string;
          procedure_type: string;
          product_name: string;
          scenario_gender: string | null;
          source_credits: Json;
          title: string;
          width: number | null;
        };
        Insert: {
          after_date: string;
          after_path?: string | null;
          before_date: string;
          before_path: string;
          body_area: string;
          category: string;
          created_at?: string;
          created_by: string;
          description: string;
          height?: number | null;
          id?: string;
          organization_id: string;
          procedure_type?: string;
          product_name?: string;
          scenario_gender?: string | null;
          source_credits?: Json;
          title: string;
          width?: number | null;
        };
        Update: {
          after_date?: string;
          after_path?: string | null;
          before_date?: string;
          before_path?: string;
          body_area?: string;
          category?: string;
          created_at?: string;
          created_by?: string;
          description?: string;
          height?: number | null;
          id?: string;
          organization_id?: string;
          procedure_type?: string;
          product_name?: string;
          scenario_gender?: string | null;
          source_credits?: Json;
          title?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "gallery_demo_cases_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gallery_demo_cases_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          profile_id: string;
          role: Database["public"]["Enums"]["organization_role"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          profile_id: string;
          role: Database["public"]["Enums"]["organization_role"];
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          profile_id?: string;
          role?: Database["public"]["Enums"]["organization_role"];
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_accounts: {
        Row: {
          created_at: string;
          id: string;
          patient_id: string;
          profile_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          patient_id: string;
          profile_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          patient_id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patient_accounts_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: true;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_accounts_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          organization_id: string;
          patient_id: string;
          revoked_at: string | null;
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by: string;
          organization_id: string;
          patient_id: string;
          revoked_at?: string | null;
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          organization_id?: string;
          patient_id?: string;
          revoked_at?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patient_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_invitations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_invitations_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      patients: {
        Row: {
          contact_email: string | null;
          created_at: string;
          date_of_birth: string | null;
          first_name: string;
          gender: string | null;
          id: string;
          last_name: string;
          organization_id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          contact_email?: string | null;
          created_at?: string;
          date_of_birth?: string | null;
          first_name: string;
          gender?: string | null;
          id?: string;
          last_name: string;
          organization_id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          contact_email?: string | null;
          created_at?: string;
          date_of_birth?: string | null;
          first_name?: string;
          gender?: string | null;
          id?: string;
          last_name?: string;
          organization_id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patients_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      photo_sessions: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          missing_angles_reason: string | null;
          notes: string | null;
          protocol_id: string;
          released_to_patient: boolean;
          session_date: string;
          session_type: Database["public"]["Enums"]["session_type"];
          status: Database["public"]["Enums"]["session_status"];
          treatment_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          missing_angles_reason?: string | null;
          notes?: string | null;
          protocol_id: string;
          released_to_patient?: boolean;
          session_date: string;
          session_type: Database["public"]["Enums"]["session_type"];
          status?: Database["public"]["Enums"]["session_status"];
          treatment_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          missing_angles_reason?: string | null;
          notes?: string | null;
          protocol_id?: string;
          released_to_patient?: boolean;
          session_date?: string;
          session_type?: Database["public"]["Enums"]["session_type"];
          status?: Database["public"]["Enums"]["session_status"];
          treatment_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "photo_sessions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "photo_sessions_protocol_id_fkey";
            columns: ["protocol_id"];
            isOneToOne: false;
            referencedRelation: "photography_protocols";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "photo_sessions_treatment_id_fkey";
            columns: ["treatment_id"];
            isOneToOne: false;
            referencedRelation: "treatments";
            referencedColumns: ["id"];
          },
        ];
      };
      photography_angles: {
        Row: {
          code: string;
          id: string;
          instructions: string;
          name: string;
          protocol_id: string;
          sort_order: number;
        };
        Insert: {
          code: string;
          id?: string;
          instructions: string;
          name: string;
          protocol_id: string;
          sort_order: number;
        };
        Update: {
          code?: string;
          id?: string;
          instructions?: string;
          name?: string;
          protocol_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "photography_angles_protocol_id_fkey";
            columns: ["protocol_id"];
            isOneToOne: false;
            referencedRelation: "photography_protocols";
            referencedColumns: ["id"];
          },
        ];
      };
      photography_protocols: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          name: string;
          version: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          version: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          version?: number;
        };
        Relationships: [];
      };
      photos: {
        Row: {
          angle_id: string;
          body_area: string;
          camera_facing: string | null;
          captured_at: string | null;
          captured_by: string;
          created_at: string;
          file_size_bytes: number | null;
          height: number | null;
          id: string;
          mime_type: string | null;
          notes: string | null;
          overlay_opacity: number | null;
          reference_photo_id: string | null;
          session_id: string;
          sha256: string | null;
          source: Database["public"]["Enums"]["photo_source"];
          storage_path: string;
          upload_status: Database["public"]["Enums"]["upload_status"];
          uploaded_at: string | null;
          width: number | null;
        };
        Insert: {
          angle_id: string;
          body_area: string;
          camera_facing?: string | null;
          captured_at?: string | null;
          captured_by: string;
          created_at?: string;
          file_size_bytes?: number | null;
          height?: number | null;
          id?: string;
          mime_type?: string | null;
          notes?: string | null;
          overlay_opacity?: number | null;
          reference_photo_id?: string | null;
          session_id: string;
          sha256?: string | null;
          source: Database["public"]["Enums"]["photo_source"];
          storage_path: string;
          upload_status?: Database["public"]["Enums"]["upload_status"];
          uploaded_at?: string | null;
          width?: number | null;
        };
        Update: {
          angle_id?: string;
          body_area?: string;
          camera_facing?: string | null;
          captured_at?: string | null;
          captured_by?: string;
          created_at?: string;
          file_size_bytes?: number | null;
          height?: number | null;
          id?: string;
          mime_type?: string | null;
          notes?: string | null;
          overlay_opacity?: number | null;
          reference_photo_id?: string | null;
          session_id?: string;
          sha256?: string | null;
          source?: Database["public"]["Enums"]["photo_source"];
          storage_path?: string;
          upload_status?: Database["public"]["Enums"]["upload_status"];
          uploaded_at?: string | null;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "photos_angle_id_fkey";
            columns: ["angle_id"];
            isOneToOne: false;
            referencedRelation: "photography_angles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "photos_captured_by_fkey";
            columns: ["captured_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "photos_reference_photo_id_fkey";
            columns: ["reference_photo_id"];
            isOneToOne: false;
            referencedRelation: "photos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "photos_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "photo_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      treatments: {
        Row: {
          body_area: string;
          category: string;
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          name: string;
          patient_id: string;
          procedure_type: string;
          product_name: string;
          protocol_code: string;
          start_date: string | null;
          status: Database["public"]["Enums"]["treatment_status"];
          updated_at: string;
        };
        Insert: {
          body_area: string;
          category: string;
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          name: string;
          patient_id: string;
          procedure_type?: string;
          product_name?: string;
          protocol_code?: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["treatment_status"];
          updated_at?: string;
        };
        Update: {
          body_area?: string;
          category?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          name?: string;
          patient_id?: string;
          procedure_type?: string;
          product_name?: string;
          protocol_code?: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["treatment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "treatments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "treatments_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      clinic_gallery_entries: {
        Row: {
          after_date: string | null;
          after_height: number | null;
          after_path: string | null;
          after_photo_id: string | null;
          after_session_id: string | null;
          after_width: number | null;
          alignment: Json | null;
          angle_name: string | null;
          before_date: string | null;
          before_height: number | null;
          before_path: string | null;
          before_photo_id: string | null;
          before_session_id: string | null;
          before_width: number | null;
          body_area: string | null;
          category: string | null;
          created_at: string | null;
          entry_kind: string | null;
          id: string | null;
          is_plate: boolean | null;
          notes: string | null;
          organization_id: string | null;
          patient_gender: string | null;
          patient_id: string | null;
          patient_name: string | null;
          procedure_type: string | null;
          product_name: string | null;
          shared: boolean | null;
          source_credits: Json | null;
          treatment_id: string | null;
          treatment_name: string | null;
          uploaded_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_patient_invitation: {
        Args: { raw_token: string };
        Returns: string;
      };
      add_organization_member: {
        Args: { member_email: string; target_org: string };
        Returns: undefined;
      };
      clinic_gallery_facets: { Args: { target_org: string }; Returns: Json };
      create_organization: { Args: { org_name: string }; Returns: string };
      prepare_clinic_publication: { Args: { payload: Json }; Returns: string };
      remove_organization_member: {
        Args: { target_org: string; target_profile: string };
        Returns: undefined;
      };
      set_organization_member_role: {
        Args: {
          next_role: Database["public"]["Enums"]["organization_role"];
          target_org: string;
          target_profile: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      organization_role: "clinic_admin" | "professional";
      photo_source: "camera" | "gallery";
      session_status: "draft" | "completed" | "cancelled";
      session_type: "baseline" | "follow_up";
      treatment_status: "planned" | "active" | "completed" | "cancelled";
      upload_status: "pending" | "uploaded" | "failed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
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
      organization_role: ["clinic_admin", "professional"],
      photo_source: ["camera", "gallery"],
      session_status: ["draft", "completed", "cancelled"],
      session_type: ["baseline", "follow_up"],
      treatment_status: ["planned", "active", "completed", "cancelled"],
      upload_status: ["pending", "uploaded", "failed"],
    },
  },
} as const;
