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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      acteur_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          nom: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          nom: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
          updated_at?: string
        }
        Relationships: []
      }
      acteurs: {
        Row: {
          actif: boolean
          created_at: string
          description_poste: string | null
          fonction: string | null
          group_id: string | null
          id: string
          organisation: string | null
          type_acteur: Database["public"]["Enums"]["acteur_type"]
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          description_poste?: string | null
          fonction?: string | null
          group_id?: string | null
          id?: string
          organisation?: string | null
          type_acteur?: Database["public"]["Enums"]["acteur_type"]
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          description_poste?: string | null
          fonction?: string | null
          group_id?: string | null
          id?: string
          organisation?: string | null
          type_acteur?: Database["public"]["Enums"]["acteur_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acteurs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "acteur_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      action_notes: {
        Row: {
          action_id: string
          avancement: number
          contenu: string
          created_at: string
          created_by: string | null
          date_note: string
          id: string
        }
        Insert: {
          action_id: string
          avancement?: number
          contenu?: string
          created_at?: string
          created_by?: string | null
          date_note?: string
          id?: string
        }
        Update: {
          action_id?: string
          avancement?: number
          contenu?: string
          created_at?: string
          created_by?: string | null
          date_note?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_notes_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
        ]
      }
      actions: {
        Row: {
          commentaire_cloture: string | null
          created_at: string
          date_cloture: string | null
          description: string
          echeance: string | null
          id: string
          preuve: string | null
          responsable_id: string | null
          responsable_user_id: string | null
          source_id: string | null
          source_type: string
          statut: Database["public"]["Enums"]["action_status"]
          type_action: Database["public"]["Enums"]["action_type"]
          updated_at: string
        }
        Insert: {
          commentaire_cloture?: string | null
          created_at?: string
          date_cloture?: string | null
          description: string
          echeance?: string | null
          id?: string
          preuve?: string | null
          responsable_id?: string | null
          responsable_user_id?: string | null
          source_id?: string | null
          source_type: string
          statut?: Database["public"]["Enums"]["action_status"]
          type_action: Database["public"]["Enums"]["action_type"]
          updated_at?: string
        }
        Update: {
          commentaire_cloture?: string | null
          created_at?: string
          date_cloture?: string | null
          description?: string
          echeance?: string | null
          id?: string
          preuve?: string | null
          responsable_id?: string | null
          responsable_user_id?: string | null
          source_id?: string | null
          source_type?: string
          statut?: Database["public"]["Enums"]["action_status"]
          type_action?: Database["public"]["Enums"]["action_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "acteurs"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      audit_findings: {
        Row: {
          audit_id: string
          created_at: string
          description: string
          id: string
          preuve: string | null
          process_id: string | null
          statut: Database["public"]["Enums"]["nc_status"]
          type_constat: Database["public"]["Enums"]["finding_type"]
          updated_at: string
        }
        Insert: {
          audit_id: string
          created_at?: string
          description: string
          id?: string
          preuve?: string | null
          process_id?: string | null
          statut?: Database["public"]["Enums"]["nc_status"]
          type_constat: Database["public"]["Enums"]["finding_type"]
          updated_at?: string
        }
        Update: {
          audit_id?: string
          created_at?: string
          description?: string
          id?: string
          preuve?: string | null
          process_id?: string | null
          statut?: Database["public"]["Enums"]["nc_status"]
          type_constat?: Database["public"]["Enums"]["finding_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_findings_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      audits: {
        Row: {
          auditeur_id: string | null
          checklist: Json | null
          created_at: string
          date_audit: string | null
          date_fin: string | null
          frequence: string | null
          id: string
          methodes: string | null
          perimetre: string | null
          preuve_realisation: string | null
          programme: string | null
          rapport: string | null
          reference: string
          responsabilites: string | null
          resultats: string | null
          statut: Database["public"]["Enums"]["audit_status"]
          type_audit: Database["public"]["Enums"]["audit_type"]
          updated_at: string
        }
        Insert: {
          auditeur_id?: string | null
          checklist?: Json | null
          created_at?: string
          date_audit?: string | null
          date_fin?: string | null
          frequence?: string | null
          id?: string
          methodes?: string | null
          perimetre?: string | null
          preuve_realisation?: string | null
          programme?: string | null
          rapport?: string | null
          reference: string
          responsabilites?: string | null
          resultats?: string | null
          statut?: Database["public"]["Enums"]["audit_status"]
          type_audit: Database["public"]["Enums"]["audit_type"]
          updated_at?: string
        }
        Update: {
          auditeur_id?: string | null
          checklist?: Json | null
          created_at?: string
          date_audit?: string | null
          date_fin?: string | null
          frequence?: string | null
          id?: string
          methodes?: string | null
          perimetre?: string | null
          preuve_realisation?: string | null
          programme?: string | null
          rapport?: string | null
          reference?: string
          responsabilites?: string | null
          resultats?: string | null
          statut?: Database["public"]["Enums"]["audit_status"]
          type_audit?: Database["public"]["Enums"]["audit_type"]
          updated_at?: string
        }
        Relationships: []
      }
      bpmn_diagrams: {
        Row: {
          created_at: string
          created_by: string | null
          donnees: Json | null
          id: string
          nom: string
          process_id: string
          statut: Database["public"]["Enums"]["process_status"]
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          donnees?: Json | null
          id?: string
          nom: string
          process_id: string
          statut?: Database["public"]["Enums"]["process_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          donnees?: Json | null
          id?: string
          nom?: string
          process_id?: string
          statut?: Database["public"]["Enums"]["process_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "bpmn_diagrams_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_formation: {
        Row: {
          annee: number
          budget_prevu: number
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          annee: number
          budget_prevu?: number
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          annee?: number
          budget_prevu?: number
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_survey_answers: {
        Row: {
          answer_text: string
          answer_value: number | null
          created_at: string
          id: string
          question_id: string
          response_id: string
        }
        Insert: {
          answer_text?: string
          answer_value?: number | null
          created_at?: string
          id?: string
          question_id: string
          response_id: string
        }
        Update: {
          answer_text?: string
          answer_value?: number | null
          created_at?: string
          id?: string
          question_id?: string
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_survey_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "client_survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_survey_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "client_survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      client_survey_comments: {
        Row: {
          action_id: string | null
          category: string
          comment_text: string
          created_at: string
          id: string
          question_id: string | null
          response_id: string
          updated_at: string
        }
        Insert: {
          action_id?: string | null
          category?: string
          comment_text?: string
          created_at?: string
          id?: string
          question_id?: string | null
          response_id: string
          updated_at?: string
        }
        Update: {
          action_id?: string | null
          category?: string
          comment_text?: string
          created_at?: string
          id?: string
          question_id?: string | null
          response_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_survey_comments_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_survey_comments_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "client_survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_survey_comments_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "client_survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      client_survey_questions: {
        Row: {
          created_at: string
          evaluation_config: Json | null
          id: string
          image_url: string | null
          ordre: number
          poids: number
          question_text: string
          question_type: string
          section_title: string | null
          survey_id: string
        }
        Insert: {
          created_at?: string
          evaluation_config?: Json | null
          id?: string
          image_url?: string | null
          ordre?: number
          poids?: number
          question_text?: string
          question_type?: string
          section_title?: string | null
          survey_id: string
        }
        Update: {
          created_at?: string
          evaluation_config?: Json | null
          id?: string
          image_url?: string | null
          ordre?: number
          poids?: number
          question_text?: string
          question_type?: string
          section_title?: string | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "client_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      client_survey_responses: {
        Row: {
          created_at: string
          id: string
          respondent_email: string | null
          respondent_name: string | null
          survey_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          respondent_email?: string | null
          respondent_name?: string | null
          survey_id: string
        }
        Update: {
          created_at?: string
          id?: string
          respondent_email?: string | null
          respondent_name?: string | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "client_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      client_survey_shares: {
        Row: {
          created_at: string
          id: string
          shared_with_user_id: string
          survey_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shared_with_user_id: string
          survey_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shared_with_user_id?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_survey_shares_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "client_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      client_surveys: {
        Row: {
          client: string | null
          created_at: string
          created_by: string | null
          department: string
          description: string
          id: string
          mode_sondage: string
          name: string
          objectif: string
          process_id: string | null
          product_service: string
          public_token: string
          status: string
          survey_date: string | null
          template_id: string | null
          template_name: string | null
          template_version: number | null
          type_sondage: string
          updated_at: string
        }
        Insert: {
          client?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          description?: string
          id?: string
          mode_sondage?: string
          name: string
          objectif?: string
          process_id?: string | null
          product_service?: string
          public_token?: string
          status?: string
          survey_date?: string | null
          template_id?: string | null
          template_name?: string | null
          template_version?: number | null
          type_sondage?: string
          updated_at?: string
        }
        Update: {
          client?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          description?: string
          id?: string
          mode_sondage?: string
          name?: string
          objectif?: string
          process_id?: string | null
          product_service?: string
          public_token?: string
          status?: string
          survey_date?: string | null
          template_id?: string | null
          template_name?: string | null
          template_version?: number | null
          type_sondage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_surveys_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_surveys_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_mentions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          mentioned_user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          mentioned_user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          mentioned_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "project_action_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      competences: {
        Row: {
          acteur_id: string
          commentaire: string
          competence: string
          created_at: string
          date_evaluation: string
          id: string
          niveau: string
          prochaine_evaluation: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          acteur_id: string
          commentaire?: string
          competence?: string
          created_at?: string
          date_evaluation?: string
          id?: string
          niveau?: string
          prochaine_evaluation?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          acteur_id?: string
          commentaire?: string
          competence?: string
          created_at?: string
          date_evaluation?: string
          id?: string
          niveau?: string
          prochaine_evaluation?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competences_acteur_id_fkey"
            columns: ["acteur_id"]
            isOneToOne: false
            referencedRelation: "acteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      context_issue_actions: {
        Row: {
          context_issue_id: string
          created_at: string
          date_revue: string | null
          description: string
          id: string
          responsable: string | null
          responsable_user_id: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          context_issue_id: string
          created_at?: string
          date_revue?: string | null
          description?: string
          id?: string
          responsable?: string | null
          responsable_user_id?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          context_issue_id?: string
          created_at?: string
          date_revue?: string | null
          description?: string
          id?: string
          responsable?: string | null
          responsable_user_id?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "context_issue_actions_context_issue_id_fkey"
            columns: ["context_issue_id"]
            isOneToOne: false
            referencedRelation: "context_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      context_issue_processes: {
        Row: {
          context_issue_id: string
          created_at: string
          id: string
          process_id: string
        }
        Insert: {
          context_issue_id: string
          created_at?: string
          id?: string
          process_id: string
        }
        Update: {
          context_issue_id?: string
          created_at?: string
          id?: string
          process_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "context_issue_processes_context_issue_id_fkey"
            columns: ["context_issue_id"]
            isOneToOne: false
            referencedRelation: "context_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "context_issue_processes_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      context_issues: {
        Row: {
          climat_pertinent: boolean
          created_at: string
          description: string | null
          domaine: string
          id: string
          impact: Database["public"]["Enums"]["impact_level"]
          intitule: string
          reference: string
          type_enjeu: Database["public"]["Enums"]["context_issue_type"]
          updated_at: string
        }
        Insert: {
          climat_pertinent?: boolean
          created_at?: string
          description?: string | null
          domaine?: string
          id?: string
          impact?: Database["public"]["Enums"]["impact_level"]
          intitule: string
          reference: string
          type_enjeu?: Database["public"]["Enums"]["context_issue_type"]
          updated_at?: string
        }
        Update: {
          climat_pertinent?: boolean
          created_at?: string
          description?: string | null
          domaine?: string
          id?: string
          impact?: Database["public"]["Enums"]["impact_level"]
          intitule?: string
          reference?: string
          type_enjeu?: Database["public"]["Enums"]["context_issue_type"]
          updated_at?: string
        }
        Relationships: []
      }
      custom_role_permissions: {
        Row: {
          can_delete: boolean
          can_edit: boolean
          can_read: boolean
          can_read_detail: boolean
          created_at: string
          custom_role_id: string
          id: string
          module: string
          updated_at: string
        }
        Insert: {
          can_delete?: boolean
          can_edit?: boolean
          can_read?: boolean
          can_read_detail?: boolean
          created_at?: string
          custom_role_id: string
          id?: string
          module: string
          updated_at?: string
        }
        Update: {
          can_delete?: boolean
          can_edit?: boolean
          can_read?: boolean
          can_read_detail?: boolean
          created_at?: string
          custom_role_id?: string
          id?: string
          module?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_role_permissions_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          nom: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          nom: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_actor_permissions: {
        Row: {
          acteur_id: string
          allowed_tag_ids: string[] | null
          allowed_type_ids: string[] | null
          can_delete: boolean | null
          can_download: boolean | null
          can_read: boolean | null
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          acteur_id: string
          allowed_tag_ids?: string[] | null
          allowed_type_ids?: string[] | null
          can_delete?: boolean | null
          can_download?: boolean | null
          can_read?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          acteur_id?: string
          allowed_tag_ids?: string[] | null
          allowed_type_ids?: string[] | null
          can_delete?: boolean | null
          can_download?: boolean | null
          can_read?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_actor_permissions_acteur_id_fkey"
            columns: ["acteur_id"]
            isOneToOne: true
            referencedRelation: "acteurs"
            referencedColumns: ["id"]
          },
        ]
      }
      document_code_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          include_process: boolean
          next_seq: number
          padding: number
          prefix: string
          separator: string
          type_document: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          include_process?: boolean
          next_seq?: number
          padding?: number
          prefix: string
          separator?: string
          type_document: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          include_process?: boolean
          next_seq?: number
          padding?: number
          prefix?: string
          separator?: string
          type_document?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_processes: {
        Row: {
          created_at: string
          document_id: string
          id: string
          process_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          process_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          process_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_processes_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_processes_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tag_links: {
        Row: {
          document_id: string
          id: string
          tag_id: string
        }
        Insert: {
          document_id: string
          id?: string
          tag_id: string
        }
        Update: {
          document_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_tag_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_tag_links_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "document_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          label: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          label: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          label?: string
        }
        Relationships: []
      }
      document_types: {
        Row: {
          actif: boolean | null
          code: string
          created_at: string | null
          id: string
          label: string
        }
        Insert: {
          actif?: boolean | null
          code: string
          created_at?: string | null
          id?: string
          label: string
        }
        Update: {
          actif?: boolean | null
          code?: string
          created_at?: string | null
          id?: string
          label?: string
        }
        Relationships: []
      }
      document_workflow_history: {
        Row: {
          action: string
          commentaire: string | null
          created_at: string
          document_id: string
          from_statut: string | null
          id: string
          to_statut: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          commentaire?: string | null
          created_at?: string
          document_id: string
          from_statut?: string | null
          id?: string
          to_statut?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          commentaire?: string | null
          created_at?: string
          document_id?: string
          from_statut?: string | null
          id?: string
          to_statut?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_workflow_history_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          approbateur_user_id: string | null
          archive: boolean
          chemin_fichier: string | null
          code: string | null
          consulte_count: number | null
          created_at: string
          date_approbation: string | null
          date_prochaine_revue: string | null
          date_soumission: string | null
          date_verification: string | null
          description: string | null
          frequence_revue_mois: number | null
          id: string
          motif_refus: string | null
          nom_fichier: string | null
          obsolete_motif: string | null
          process_id: string | null
          redacteur_user_id: string | null
          retired_at: string | null
          retired_by: string | null
          statut_workflow: string
          taille_fichier: number | null
          titre: string
          type_document: Database["public"]["Enums"]["document_type"]
          updated_at: string
          uploaded_by: string | null
          verificateur_user_id: string | null
          version: number
        }
        Insert: {
          approbateur_user_id?: string | null
          archive?: boolean
          chemin_fichier?: string | null
          code?: string | null
          consulte_count?: number | null
          created_at?: string
          date_approbation?: string | null
          date_prochaine_revue?: string | null
          date_soumission?: string | null
          date_verification?: string | null
          description?: string | null
          frequence_revue_mois?: number | null
          id?: string
          motif_refus?: string | null
          nom_fichier?: string | null
          obsolete_motif?: string | null
          process_id?: string | null
          redacteur_user_id?: string | null
          retired_at?: string | null
          retired_by?: string | null
          statut_workflow?: string
          taille_fichier?: number | null
          titre: string
          type_document: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          uploaded_by?: string | null
          verificateur_user_id?: string | null
          version?: number
        }
        Update: {
          approbateur_user_id?: string | null
          archive?: boolean
          chemin_fichier?: string | null
          code?: string | null
          consulte_count?: number | null
          created_at?: string
          date_approbation?: string | null
          date_prochaine_revue?: string | null
          date_soumission?: string | null
          date_verification?: string | null
          description?: string | null
          frequence_revue_mois?: number | null
          id?: string
          motif_refus?: string | null
          nom_fichier?: string | null
          obsolete_motif?: string | null
          process_id?: string | null
          redacteur_user_id?: string | null
          retired_at?: string | null
          retired_by?: string | null
          statut_workflow?: string
          taille_fichier?: number | null
          titre?: string
          type_document?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          uploaded_by?: string | null
          verificateur_user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      element_notes: {
        Row: {
          avancement: number
          contenu: string
          created_at: string
          created_by: string | null
          date_note: string
          element_id: string
          element_type: string
          id: string
          is_response: boolean
          parent_note_id: string | null
        }
        Insert: {
          avancement?: number
          contenu?: string
          created_at?: string
          created_by?: string | null
          date_note?: string
          element_id: string
          element_type: string
          id?: string
          is_response?: boolean
          parent_note_id?: string | null
        }
        Update: {
          avancement?: number
          contenu?: string
          created_at?: string
          created_by?: string | null
          date_note?: string
          element_id?: string
          element_type?: string
          id?: string
          is_response?: boolean
          parent_note_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "element_notes_parent_note_id_fkey"
            columns: ["parent_note_id"]
            isOneToOne: false
            referencedRelation: "element_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          email_type: string
          entity_id: string | null
          entity_type: string | null
          entity_url: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          notif_type: string | null
          recipient_email: string
          status: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_type: string
          entity_id?: string | null
          entity_type?: string | null
          entity_url?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notif_type?: string | null
          recipient_email: string
          status: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_type?: string
          entity_id?: string | null
          entity_type?: string | null
          entity_url?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notif_type?: string | null
          recipient_email?: string
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      formation_participants: {
        Row: {
          acteur_id: string
          created_at: string
          formation_id: string
          id: string
          profile_id: string | null
        }
        Insert: {
          acteur_id: string
          created_at?: string
          formation_id: string
          id?: string
          profile_id?: string | null
        }
        Update: {
          acteur_id?: string
          created_at?: string
          formation_id?: string
          id?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formation_participants_acteur_id_fkey"
            columns: ["acteur_id"]
            isOneToOne: false
            referencedRelation: "acteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formation_participants_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formation_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      formations: {
        Row: {
          acteur_id: string
          commentaire: string
          competence_liee: string | null
          competences_liees: string[] | null
          cout: number
          created_at: string
          date_formation: string
          description: string
          duree_heures: number
          efficacite: string
          formateur: string
          id: string
          preuve: string | null
          profile_id: string | null
          titre: string
          type_formation: string
          updated_at: string
        }
        Insert: {
          acteur_id: string
          commentaire?: string
          competence_liee?: string | null
          competences_liees?: string[] | null
          cout?: number
          created_at?: string
          date_formation?: string
          description?: string
          duree_heures?: number
          efficacite?: string
          formateur?: string
          id?: string
          preuve?: string | null
          profile_id?: string | null
          titre?: string
          type_formation?: string
          updated_at?: string
        }
        Update: {
          acteur_id?: string
          commentaire?: string
          competence_liee?: string | null
          competences_liees?: string[] | null
          cout?: number
          created_at?: string
          date_formation?: string
          description?: string
          duree_heures?: number
          efficacite?: string
          formateur?: string
          id?: string
          preuve?: string | null
          profile_id?: string | null
          titre?: string
          type_formation?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formations_acteur_id_fkey"
            columns: ["acteur_id"]
            isOneToOne: false
            referencedRelation: "acteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_actions: {
        Row: {
          created_at: string
          date_prevue: string | null
          deadline: string | null
          description: string
          id: string
          indicator_id: string
          responsable: string | null
          responsable_user_id: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_prevue?: string | null
          deadline?: string | null
          description?: string
          id?: string
          indicator_id: string
          responsable?: string | null
          responsable_user_id?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_prevue?: string | null
          deadline?: string | null
          description?: string
          id?: string
          indicator_id?: string
          responsable?: string | null
          responsable_user_id?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_actions_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_moyens: {
        Row: {
          budget: number | null
          created_at: string
          date_prevue: string | null
          deadline: string | null
          description: string
          id: string
          indicator_id: string
          responsable: string | null
          responsable_user_id: string | null
          statut: string
          type_moyen: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          date_prevue?: string | null
          deadline?: string | null
          description?: string
          id?: string
          indicator_id: string
          responsable?: string | null
          responsable_user_id?: string | null
          statut?: string
          type_moyen?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          date_prevue?: string | null
          deadline?: string | null
          description?: string
          id?: string
          indicator_id?: string
          responsable?: string | null
          responsable_user_id?: string | null
          statut?: string
          type_moyen?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_moyens_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_values: {
        Row: {
          commentaire: string | null
          created_at: string
          date_mesure: string
          id: string
          indicator_id: string
          saisi_par: string | null
          valeur: number
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          date_mesure: string
          id?: string
          indicator_id: string
          saisi_par?: string | null
          valeur: number
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          date_mesure?: string
          id?: string
          indicator_id?: string
          saisi_par?: string | null
          valeur?: number
        }
        Relationships: [
          {
            foreignKeyName: "indicator_values_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      indicators: {
        Row: {
          cible: number | null
          created_at: string
          formule: string | null
          frequence: Database["public"]["Enums"]["indicator_frequency"]
          id: string
          moyens: string | null
          nom: string
          process_id: string
          seuil_alerte: number | null
          type_indicateur: Database["public"]["Enums"]["indicator_type"]
          unite: string | null
          updated_at: string
        }
        Insert: {
          cible?: number | null
          created_at?: string
          formule?: string | null
          frequence?: Database["public"]["Enums"]["indicator_frequency"]
          id?: string
          moyens?: string | null
          nom: string
          process_id: string
          seuil_alerte?: number | null
          type_indicateur?: Database["public"]["Enums"]["indicator_type"]
          unite?: string | null
          updated_at?: string
        }
        Update: {
          cible?: number | null
          created_at?: string
          formule?: string | null
          frequence?: Database["public"]["Enums"]["indicator_frequency"]
          id?: string
          moyens?: string | null
          nom?: string
          process_id?: string
          seuil_alerte?: number | null
          type_indicateur?: Database["public"]["Enums"]["indicator_type"]
          unite?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicators_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          code: string
          created_at: string
          duration_days: number | null
          ordinal: number
          used: boolean
          used_at: string | null
          used_by_install: string | null
        }
        Insert: {
          code: string
          created_at?: string
          duration_days?: number | null
          ordinal: number
          used?: boolean
          used_at?: string | null
          used_by_install?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          duration_days?: number | null
          ordinal?: number
          used?: boolean
          used_at?: string | null
          used_by_install?: string | null
        }
        Relationships: []
      }
      management_reviews: {
        Row: {
          actions_decidees: string
          compte_rendu: string
          created_at: string
          date_revue: string
          decisions: string
          elements_entree: string
          id: string
          participants: string
          prochaine_revue: string | null
          reference: string
          responsable_id: string | null
          statut: string
          type_revue: string
          updated_at: string
        }
        Insert: {
          actions_decidees?: string
          compte_rendu?: string
          created_at?: string
          date_revue?: string
          decisions?: string
          elements_entree?: string
          id?: string
          participants?: string
          prochaine_revue?: string | null
          reference?: string
          responsable_id?: string | null
          statut?: string
          type_revue?: string
          updated_at?: string
        }
        Update: {
          actions_decidees?: string
          compte_rendu?: string
          created_at?: string
          date_revue?: string
          decisions?: string
          elements_entree?: string
          id?: string
          participants?: string
          prochaine_revue?: string | null
          reference?: string
          responsable_id?: string | null
          statut?: string
          type_revue?: string
          updated_at?: string
        }
        Relationships: []
      }
      nc_actions: {
        Row: {
          created_at: string
          date_prevue: string | null
          deadline: string | null
          description: string
          id: string
          nc_id: string
          responsable: string | null
          responsable_user_id: string | null
          statut: string
          type_action: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_prevue?: string | null
          deadline?: string | null
          description: string
          id?: string
          nc_id: string
          responsable?: string | null
          responsable_user_id?: string | null
          statut?: string
          type_action?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_prevue?: string | null
          deadline?: string | null
          description?: string
          id?: string
          nc_id?: string
          responsable?: string | null
          responsable_user_id?: string | null
          statut?: string
          type_action?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nc_actions_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "nonconformities"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_root_cause_analyses: {
        Row: {
          conclusion: string | null
          created_at: string
          data: Json
          id: string
          methode: string
          nc_id: string
          updated_at: string
        }
        Insert: {
          conclusion?: string | null
          created_at?: string
          data?: Json
          id?: string
          methode: string
          nc_id: string
          updated_at?: string
        }
        Update: {
          conclusion?: string | null
          created_at?: string
          data?: Json
          id?: string
          methode?: string
          nc_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nc_root_cause_analyses_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "nonconformities"
            referencedColumns: ["id"]
          },
        ]
      }
      nonconformities: {
        Row: {
          audit_id: string | null
          cause_racine: string | null
          correction_immediate: string | null
          created_at: string
          created_by: string | null
          criticite: number | null
          date_detection: string
          description: string
          gravite: Database["public"]["Enums"]["nc_severity"]
          id: string
          nature_nc: string | null
          origine: string | null
          plan_action: string | null
          process_id: string | null
          reference: string
          resultats_actions: string | null
          statut: Database["public"]["Enums"]["nc_status"]
          updated_at: string
          verification_efficacite: string | null
        }
        Insert: {
          audit_id?: string | null
          cause_racine?: string | null
          correction_immediate?: string | null
          created_at?: string
          created_by?: string | null
          criticite?: number | null
          date_detection?: string
          description: string
          gravite: Database["public"]["Enums"]["nc_severity"]
          id?: string
          nature_nc?: string | null
          origine?: string | null
          plan_action?: string | null
          process_id?: string | null
          reference: string
          resultats_actions?: string | null
          statut?: Database["public"]["Enums"]["nc_status"]
          updated_at?: string
          verification_efficacite?: string | null
        }
        Update: {
          audit_id?: string | null
          cause_racine?: string | null
          correction_immediate?: string | null
          created_at?: string
          created_by?: string | null
          criticite?: number | null
          date_detection?: string
          description?: string
          gravite?: Database["public"]["Enums"]["nc_severity"]
          id?: string
          nature_nc?: string | null
          origine?: string | null
          plan_action?: string | null
          process_id?: string | null
          reference?: string
          resultats_actions?: string | null
          statut?: Database["public"]["Enums"]["nc_status"]
          updated_at?: string
          verification_efficacite?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nonconformities_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nonconformities_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_config: {
        Row: {
          channel: string
          created_at: string
          entity_type: string
          id: string
          notif_type: string
          scope: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          entity_type: string
          id?: string
          notif_type: string
          scope: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          entity_type?: string
          id?: string
          notif_type?: string
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          assignation: string
          created_at: string
          echeance_proche: string
          id: string
          rappel_jours: number
          retard: string
          statut_change: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignation?: string
          created_at?: string
          echeance_proche?: string
          id?: string
          rappel_jours?: number
          retard?: string
          statut_change?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignation?: string
          created_at?: string
          echeance_proche?: string
          id?: string
          rappel_jours?: number
          retard?: string
          statut_change?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          email_sent: boolean | null
          entity_id: string | null
          entity_type: string | null
          entity_url: string | null
          id: string
          is_read: boolean
          message: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          email_sent?: boolean | null
          entity_id?: string | null
          entity_type?: string | null
          entity_url?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          title?: string
          type?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          email_sent?: boolean | null
          entity_id?: string | null
          entity_type?: string | null
          entity_url?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      permission_audit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_perms: Json | null
          old_perms: Json | null
          process_id: string | null
          target_custom_role_id: string | null
          target_role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_perms?: Json | null
          old_perms?: Json | null
          process_id?: string | null
          target_custom_role_id?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_perms?: Json | null
          old_perms?: Json | null
          process_id?: string | null
          target_custom_role_id?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_audit_log_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_audit_log_target_custom_role_id_fkey"
            columns: ["target_custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      process_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          process_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          process_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          process_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_comments_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      process_element_attentes: {
        Row: {
          created_at: string | null
          date_prevue: string | null
          description: string
          element_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          date_prevue?: string | null
          description?: string
          element_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          date_prevue?: string | null
          description?: string
          element_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_element_attentes_element_id_fkey"
            columns: ["element_id"]
            isOneToOne: false
            referencedRelation: "process_elements"
            referencedColumns: ["id"]
          },
        ]
      }
      process_elements: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          ordre: number
          process_id: string
          responsable_id: string | null
          type: Database["public"]["Enums"]["process_element_type"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          id?: string
          ordre?: number
          process_id: string
          responsable_id?: string | null
          type: Database["public"]["Enums"]["process_element_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          ordre?: number
          process_id?: string
          responsable_id?: string | null
          type?: Database["public"]["Enums"]["process_element_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_elements_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_elements_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "acteurs"
            referencedColumns: ["id"]
          },
        ]
      }
      process_evaluations: {
        Row: {
          created_at: string
          description: string
          id: string
          nom: string
          process_id: string | null
          resultat: string
          score_ca: number
          score_objectifs: number
          score_perennite: number
          score_risques: number
          score_satisfaction: number
          score_total: number
          statut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          nom: string
          process_id?: string | null
          resultat?: string
          score_ca?: number
          score_objectifs?: number
          score_perennite?: number
          score_risques?: number
          score_satisfaction?: number
          score_total?: number
          statut?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          nom?: string
          process_id?: string | null
          resultat?: string
          score_ca?: number
          score_objectifs?: number
          score_perennite?: number
          score_risques?: number
          score_satisfaction?: number
          score_total?: number
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_evaluations_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_interactions: {
        Row: {
          created_at: string
          direction: string
          element_id: string
          id: string
          source_process_id: string
          target_process_id: string
        }
        Insert: {
          created_at?: string
          direction: string
          element_id: string
          id?: string
          source_process_id: string
          target_process_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          element_id?: string
          id?: string
          source_process_id?: string
          target_process_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_interactions_element_id_fkey"
            columns: ["element_id"]
            isOneToOne: false
            referencedRelation: "process_elements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_interactions_source_process_id_fkey"
            columns: ["source_process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_interactions_target_process_id_fkey"
            columns: ["target_process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_role_permissions: {
        Row: {
          can_comment: boolean
          can_detail: boolean
          can_edit: boolean
          can_read: boolean
          can_version: boolean
          created_at: string
          custom_role_id: string | null
          id: string
          process_id: string
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string
        }
        Insert: {
          can_comment?: boolean
          can_detail?: boolean
          can_edit?: boolean
          can_read?: boolean
          can_version?: boolean
          created_at?: string
          custom_role_id?: string | null
          id?: string
          process_id: string
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
        }
        Update: {
          can_comment?: boolean
          can_detail?: boolean
          can_edit?: boolean
          can_read?: boolean
          can_version?: boolean
          created_at?: string
          custom_role_id?: string | null
          id?: string
          process_id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_role_permissions_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_role_permissions_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_tasks: {
        Row: {
          code: string
          condition: string | null
          created_at: string
          description: string
          documents: string[] | null
          entrees: string | null
          id: string
          next_activity_code: string | null
          ordre: number
          parent_code: string | null
          position_x: number | null
          position_y: number | null
          process_id: string
          responsable_id: string | null
          responsable_user_id: string | null
          sorties: string | null
          type_flux: Database["public"]["Enums"]["task_flow_type"]
          updated_at: string
        }
        Insert: {
          code: string
          condition?: string | null
          created_at?: string
          description?: string
          documents?: string[] | null
          entrees?: string | null
          id?: string
          next_activity_code?: string | null
          ordre?: number
          parent_code?: string | null
          position_x?: number | null
          position_y?: number | null
          process_id: string
          responsable_id?: string | null
          responsable_user_id?: string | null
          sorties?: string | null
          type_flux?: Database["public"]["Enums"]["task_flow_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          condition?: string | null
          created_at?: string
          description?: string
          documents?: string[] | null
          entrees?: string | null
          id?: string
          next_activity_code?: string | null
          ordre?: number
          parent_code?: string | null
          position_x?: number | null
          position_y?: number | null
          process_id?: string
          responsable_id?: string | null
          responsable_user_id?: string | null
          sorties?: string | null
          type_flux?: Database["public"]["Enums"]["task_flow_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_tasks_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_tasks_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "acteurs"
            referencedColumns: ["id"]
          },
        ]
      }
      process_versions: {
        Row: {
          created_at: string
          donnees: Json
          id: string
          modifie_par: string | null
          process_id: string
          version: number
        }
        Insert: {
          created_at?: string
          donnees: Json
          id?: string
          modifie_par?: string | null
          process_id: string
          version: number
        }
        Update: {
          created_at?: string
          donnees?: Json
          id?: string
          modifie_par?: string | null
          process_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "process_versions_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          activites: string | null
          code: string
          created_at: string
          description: string | null
          donnees_entree: string | null
          donnees_sortie: string | null
          finalite: string | null
          id: string
          inclure_bpmn_pdf: boolean
          interactions: string | null
          nom: string
          parties_prenantes: string | null
          responsable_id: string | null
          ressources: string | null
          statut: Database["public"]["Enums"]["process_status"]
          type_processus: Database["public"]["Enums"]["process_type"]
          updated_at: string
          version_courante: number
        }
        Insert: {
          activites?: string | null
          code: string
          created_at?: string
          description?: string | null
          donnees_entree?: string | null
          donnees_sortie?: string | null
          finalite?: string | null
          id?: string
          inclure_bpmn_pdf?: boolean
          interactions?: string | null
          nom: string
          parties_prenantes?: string | null
          responsable_id?: string | null
          ressources?: string | null
          statut?: Database["public"]["Enums"]["process_status"]
          type_processus: Database["public"]["Enums"]["process_type"]
          updated_at?: string
          version_courante?: number
        }
        Update: {
          activites?: string | null
          code?: string
          created_at?: string
          description?: string | null
          donnees_entree?: string | null
          donnees_sortie?: string | null
          finalite?: string | null
          id?: string
          inclure_bpmn_pdf?: boolean
          interactions?: string | null
          nom?: string
          parties_prenantes?: string | null
          responsable_id?: string | null
          ressources?: string | null
          statut?: Database["public"]["Enums"]["process_status"]
          type_processus?: Database["public"]["Enums"]["process_type"]
          updated_at?: string
          version_courante?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          acteur_id: string | null
          actif: boolean
          created_at: string
          email: string
          fonction: string | null
          id: string
          nom: string
          photo_url: string | null
          prenom: string
          updated_at: string
        }
        Insert: {
          acteur_id?: string | null
          actif?: boolean
          created_at?: string
          email?: string
          fonction?: string | null
          id: string
          nom?: string
          photo_url?: string | null
          prenom?: string
          updated_at?: string
        }
        Update: {
          acteur_id?: string | null
          actif?: boolean
          created_at?: string
          email?: string
          fonction?: string | null
          id?: string
          nom?: string
          photo_url?: string | null
          prenom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_acteur_id_fkey"
            columns: ["acteur_id"]
            isOneToOne: false
            referencedRelation: "acteurs"
            referencedColumns: ["id"]
          },
        ]
      }
      project_action_comments: {
        Row: {
          action_id: string
          content: string
          created_at: string
          id: string
          is_private: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          action_id: string
          content?: string
          created_at?: string
          id?: string
          is_private?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          action_id?: string
          content?: string
          created_at?: string
          id?: string
          is_private?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_action_comments_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "project_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_action_dependencies: {
        Row: {
          created_at: string | null
          dependency_type: string
          id: string
          project_id: string
          source_action_id: string
          target_action_id: string
        }
        Insert: {
          created_at?: string | null
          dependency_type?: string
          id?: string
          project_id: string
          source_action_id: string
          target_action_id: string
        }
        Update: {
          created_at?: string | null
          dependency_type?: string
          id?: string
          project_id?: string
          source_action_id?: string
          target_action_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_action_dependencies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_action_dependencies_source_action_id_fkey"
            columns: ["source_action_id"]
            isOneToOne: false
            referencedRelation: "project_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_action_dependencies_target_action_id_fkey"
            columns: ["target_action_id"]
            isOneToOne: false
            referencedRelation: "project_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_action_history: {
        Row: {
          action_id: string
          created_at: string
          entity_type: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          action_id: string
          created_at?: string
          entity_type?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_id?: string
          created_at?: string
          entity_type?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_action_history_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "project_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_action_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_action_links: {
        Row: {
          action_id: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action_id: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action_id?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_action_links_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "project_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_actions: {
        Row: {
          avancement: number
          created_at: string
          date_debut: string | null
          description: string | null
          echeance: string | null
          id: string
          multi_tasks: boolean
          ordre: number
          pinned: boolean
          poids: number | null
          project_id: string
          responsable_id: string | null
          responsable_id_2: string | null
          responsable_id_3: string | null
          responsable_user_id: string | null
          responsable_user_id_2: string | null
          responsable_user_id_3: string | null
          statut: string
          title: string
          updated_at: string
        }
        Insert: {
          avancement?: number
          created_at?: string
          date_debut?: string | null
          description?: string | null
          echeance?: string | null
          id?: string
          multi_tasks?: boolean
          ordre?: number
          pinned?: boolean
          poids?: number | null
          project_id: string
          responsable_id?: string | null
          responsable_id_2?: string | null
          responsable_id_3?: string | null
          responsable_user_id?: string | null
          responsable_user_id_2?: string | null
          responsable_user_id_3?: string | null
          statut?: string
          title: string
          updated_at?: string
        }
        Update: {
          avancement?: number
          created_at?: string
          date_debut?: string | null
          description?: string | null
          echeance?: string | null
          id?: string
          multi_tasks?: boolean
          ordre?: number
          pinned?: boolean
          poids?: number | null
          project_id?: string
          responsable_id?: string | null
          responsable_id_2?: string | null
          responsable_id_3?: string | null
          responsable_user_id?: string | null
          responsable_user_id_2?: string | null
          responsable_user_id_3?: string | null
          statut?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_actions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_actions_responsable_id_2_fkey"
            columns: ["responsable_id_2"]
            isOneToOne: false
            referencedRelation: "acteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_actions_responsable_id_3_fkey"
            columns: ["responsable_id_3"]
            isOneToOne: false
            referencedRelation: "acteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_actions_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "acteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_actions_responsable_user_id_2_fkey"
            columns: ["responsable_user_id_2"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_actions_responsable_user_id_3_fkey"
            columns: ["responsable_user_id_3"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_actors: {
        Row: {
          acteur_id: string
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          acteur_id: string
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          acteur_id?: string
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_actors_acteur_id_fkey"
            columns: ["acteur_id"]
            isOneToOne: false
            referencedRelation: "acteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_actors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_collaborators: {
        Row: {
          access_level: string
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_collaborators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_deadline_logs: {
        Row: {
          changed_by: string | null
          created_at: string
          entity_id: string
          entity_title: string
          entity_type: string
          id: string
          new_echeance: string | null
          old_echeance: string | null
          project_id: string
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          entity_id: string
          entity_title: string
          entity_type: string
          id?: string
          new_echeance?: string | null
          old_echeance?: string | null
          project_id: string
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          entity_id?: string
          entity_title?: string
          entity_type?: string
          id?: string
          new_echeance?: string | null
          old_echeance?: string | null
          project_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_deadline_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_processes: {
        Row: {
          created_at: string
          id: string
          process_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          process_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          process_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_processes_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_processes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          action_id: string
          avancement: number
          created_at: string
          date_debut: string | null
          echeance: string | null
          id: string
          ordre: number
          responsable_id: string | null
          responsable_user_id: string | null
          statut: string
          title: string
          updated_at: string
        }
        Insert: {
          action_id: string
          avancement?: number
          created_at?: string
          date_debut?: string | null
          echeance?: string | null
          id?: string
          ordre?: number
          responsable_id?: string | null
          responsable_user_id?: string | null
          statut?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_id?: string
          avancement?: number
          created_at?: string
          date_debut?: string | null
          echeance?: string | null
          id?: string
          ordre?: number
          responsable_id?: string | null
          responsable_user_id?: string | null
          statut?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "project_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "acteurs"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          date_debut: string | null
          date_fin: string | null
          description: string | null
          id: string
          image_url: string | null
          objectives: Json | null
          resources: string | null
          resources_list: Json | null
          responsable_user_id: string | null
          slogan: string | null
          statut: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_debut?: string | null
          date_fin?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          objectives?: Json | null
          resources?: string | null
          resources_list?: Json | null
          responsable_user_id?: string | null
          slogan?: string | null
          statut?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_debut?: string | null
          date_fin?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          objectives?: Json | null
          resources?: string | null
          resources_list?: Json | null
          responsable_user_id?: string | null
          slogan?: string | null
          statut?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_responsable_user_id_fkey"
            columns: ["responsable_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_objectives: {
        Row: {
          cible: string
          commentaire: string
          created_at: string
          description: string
          echeance: string | null
          id: string
          indicateur: string
          process_id: string | null
          reference: string
          responsable_id: string | null
          responsable_user_id: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          cible?: string
          commentaire?: string
          created_at?: string
          description?: string
          echeance?: string | null
          id?: string
          indicateur?: string
          process_id?: string | null
          reference?: string
          responsable_id?: string | null
          responsable_user_id?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          cible?: string
          commentaire?: string
          created_at?: string
          description?: string
          echeance?: string | null
          id?: string
          indicateur?: string
          process_id?: string | null
          reference?: string
          responsable_id?: string | null
          responsable_user_id?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_objectives_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_policy: {
        Row: {
          approuve_par: string | null
          contenu: string
          created_at: string
          date_approbation: string | null
          id: string
          objectifs: string
          statut: string
          titre: string
          updated_at: string
          version: number
        }
        Insert: {
          approuve_par?: string | null
          contenu?: string
          created_at?: string
          date_approbation?: string | null
          id?: string
          objectifs?: string
          statut?: string
          titre?: string
          updated_at?: string
          version?: number
        }
        Update: {
          approuve_par?: string | null
          contenu?: string
          created_at?: string
          date_approbation?: string | null
          id?: string
          objectifs?: string
          statut?: string
          titre?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      review_decisions: {
        Row: {
          created_at: string
          description: string
          echeance: string | null
          id: string
          input_item_id: string | null
          ordre: number
          responsable_id: string | null
          responsable_user_id: string | null
          review_id: string
          source_entity_id: string | null
          source_entity_type: string | null
          statut: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          echeance?: string | null
          id?: string
          input_item_id?: string | null
          ordre?: number
          responsable_id?: string | null
          responsable_user_id?: string | null
          review_id: string
          source_entity_id?: string | null
          source_entity_type?: string | null
          statut?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          echeance?: string | null
          id?: string
          input_item_id?: string | null
          ordre?: number
          responsable_id?: string | null
          responsable_user_id?: string | null
          review_id?: string
          source_entity_id?: string | null
          source_entity_type?: string | null
          statut?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_decisions_input_item_id_fkey"
            columns: ["input_item_id"]
            isOneToOne: false
            referencedRelation: "review_input_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_decisions_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "acteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_decisions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "management_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_input_items: {
        Row: {
          commentaire: string
          created_at: string
          entity_id: string | null
          id: string
          label: string
          ordre: number
          parent_id: string | null
          review_id: string
          type: string
          updated_at: string
        }
        Insert: {
          commentaire?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          label?: string
          ordre?: number
          parent_id?: string | null
          review_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          commentaire?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          label?: string
          ordre?: number
          parent_id?: string | null
          review_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_input_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "review_input_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_input_items_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "management_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_actions: {
        Row: {
          created_at: string
          date_prevue: string | null
          deadline: string | null
          description: string
          id: string
          responsable: string | null
          responsable_user_id: string | null
          risk_id: string
          statut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_prevue?: string | null
          deadline?: string | null
          description?: string
          id?: string
          responsable?: string | null
          responsable_user_id?: string | null
          risk_id: string
          statut?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_prevue?: string | null
          deadline?: string | null
          description?: string
          id?: string
          responsable?: string | null
          responsable_user_id?: string | null
          risk_id?: string
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_actions_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "risks_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_incidents: {
        Row: {
          actions_correctives: string | null
          created_at: string
          date_incident: string
          description: string
          gravite: string
          id: string
          process_id: string | null
          responsable: string | null
          risk_id: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          actions_correctives?: string | null
          created_at?: string
          date_incident?: string
          description: string
          gravite?: string
          id?: string
          process_id?: string | null
          responsable?: string | null
          risk_id?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          actions_correctives?: string | null
          created_at?: string
          date_incident?: string
          description?: string
          gravite?: string
          id?: string
          process_id?: string | null
          responsable?: string | null
          risk_id?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_incidents_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_incidents_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "risks_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_moyens: {
        Row: {
          budget: number | null
          created_at: string
          date_prevue: string | null
          deadline: string | null
          description: string
          id: string
          responsable: string | null
          responsable_user_id: string | null
          risk_id: string
          statut: string
          type_moyen: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          date_prevue?: string | null
          deadline?: string | null
          description?: string
          id?: string
          responsable?: string | null
          responsable_user_id?: string | null
          risk_id: string
          statut?: string
          type_moyen?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          date_prevue?: string | null
          deadline?: string | null
          description?: string
          id?: string
          responsable?: string | null
          responsable_user_id?: string | null
          risk_id?: string
          statut?: string
          type_moyen?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_moyens_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "risks_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      risks_opportunities: {
        Row: {
          actions_traitement: string | null
          created_at: string
          criticite: number | null
          description: string
          faisabilite: number | null
          id: string
          impact: number | null
          probabilite: number | null
          process_id: string
          statut: string
          type: Database["public"]["Enums"]["risk_type"]
          updated_at: string
        }
        Insert: {
          actions_traitement?: string | null
          created_at?: string
          criticite?: number | null
          description: string
          faisabilite?: number | null
          id?: string
          impact?: number | null
          probabilite?: number | null
          process_id: string
          statut?: string
          type: Database["public"]["Enums"]["risk_type"]
          updated_at?: string
        }
        Update: {
          actions_traitement?: string | null
          created_at?: string
          criticite?: number | null
          description?: string
          faisabilite?: number | null
          id?: string
          impact?: number | null
          probabilite?: number | null
          process_id?: string
          statut?: string
          type?: Database["public"]["Enums"]["risk_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risks_opportunities_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_delete: boolean
          can_edit: boolean
          can_read: boolean
          can_read_detail: boolean
          created_at: string
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_delete?: boolean
          can_edit?: boolean
          can_read?: boolean
          can_read_detail?: boolean
          created_at?: string
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_delete?: boolean
          can_edit?: boolean
          can_read?: boolean
          can_read_detail?: boolean
          created_at?: string
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      satisfaction_surveys: {
        Row: {
          actions_prevues: string
          analyse_resultats: string
          created_at: string
          date_enquete: string
          id: string
          nombre_reponses: number
          process_id: string | null
          reference: string
          responsable_id: string | null
          score_global: number | null
          statut: string
          titre: string
          type_enquete: string
          updated_at: string
        }
        Insert: {
          actions_prevues?: string
          analyse_resultats?: string
          created_at?: string
          date_enquete?: string
          id?: string
          nombre_reponses?: number
          process_id?: string | null
          reference?: string
          responsable_id?: string | null
          score_global?: number | null
          statut?: string
          titre?: string
          type_enquete?: string
          updated_at?: string
        }
        Update: {
          actions_prevues?: string
          analyse_resultats?: string
          created_at?: string
          date_enquete?: string
          id?: string
          nombre_reponses?: number
          process_id?: string | null
          reference?: string
          responsable_id?: string | null
          score_global?: number | null
          statut?: string
          titre?: string
          type_enquete?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "satisfaction_surveys_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          commentaire: string
          contact: string
          created_at: string
          criteres_evaluation: string
          date_evaluation: string | null
          domaine: string
          email: string | null
          id: string
          nom: string
          reference: string
          score_evaluation: number | null
          statut: string
          telephone: string | null
          type_prestataire: string
          updated_at: string
        }
        Insert: {
          commentaire?: string
          contact?: string
          created_at?: string
          criteres_evaluation?: string
          date_evaluation?: string | null
          domaine?: string
          email?: string | null
          id?: string
          nom?: string
          reference?: string
          score_evaluation?: number | null
          statut?: string
          telephone?: string | null
          type_prestataire?: string
          updated_at?: string
        }
        Update: {
          commentaire?: string
          contact?: string
          created_at?: string
          criteres_evaluation?: string
          date_evaluation?: string | null
          domaine?: string
          email?: string | null
          id?: string
          nom?: string
          reference?: string
          score_evaluation?: number | null
          statut?: string
          telephone?: string | null
          type_prestataire?: string
          updated_at?: string
        }
        Relationships: []
      }
      survey_answers: {
        Row: {
          absolute_observation: string | null
          absolute_rating: number | null
          created_at: string
          id: string
          question_label: string
          relative_observation: string | null
          relative_rating: number | null
          response_id: string | null
          section_title: string
          survey_id: string
        }
        Insert: {
          absolute_observation?: string | null
          absolute_rating?: number | null
          created_at?: string
          id?: string
          question_label: string
          relative_observation?: string | null
          relative_rating?: number | null
          response_id?: string | null
          section_title?: string
          survey_id: string
        }
        Update: {
          absolute_observation?: string | null
          absolute_rating?: number | null
          created_at?: string
          id?: string
          question_label?: string
          relative_observation?: string | null
          relative_rating?: number | null
          response_id?: string | null
          section_title?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "client_survey_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_answers_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "client_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_template_questions: {
        Row: {
          created_at: string
          has_absolute_evaluation: boolean
          has_competitor_evaluation: boolean
          has_observation_absolute: boolean
          has_observation_relative: boolean
          id: string
          is_required: boolean
          label: string
          options: Json | null
          order_index: number
          poids: number
          question_type: string
          section_id: string
        }
        Insert: {
          created_at?: string
          has_absolute_evaluation?: boolean
          has_competitor_evaluation?: boolean
          has_observation_absolute?: boolean
          has_observation_relative?: boolean
          id?: string
          is_required?: boolean
          label: string
          options?: Json | null
          order_index?: number
          poids?: number
          question_type?: string
          section_id: string
        }
        Update: {
          created_at?: string
          has_absolute_evaluation?: boolean
          has_competitor_evaluation?: boolean
          has_observation_absolute?: boolean
          has_observation_relative?: boolean
          id?: string
          is_required?: boolean
          label?: string
          options?: Json | null
          order_index?: number
          poids?: number
          question_type?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_template_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "survey_template_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_template_sections: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          order_index: number
          template_id: string
          title: string
        }
        Insert: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          order_index?: number
          template_id: string
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          order_index?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_template_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_templates: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          notes_internes: string | null
          status: string
          type: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          notes_internes?: string | null
          status?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          notes_internes?: string | null
          status?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "survey_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_custom_roles: {
        Row: {
          created_at: string
          custom_role_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_role_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_role_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      can_read_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_write_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_write_project_restricted: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      cleanup_old_audit_logs: { Args: { _days?: number }; Returns: number }
      generate_document_code: {
        Args: { _type_document: string }
        Returns: string
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_my_project_action: {
        Args: { _action_id: string; _user_id: string }
        Returns: boolean
      }
      is_my_project_task: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      project_access_level: {
        Args: { _project_id: string; _user_id: string }
        Returns: string
      }
      resolve_notification_channel: {
        Args: { _entity_type: string; _notif_type: string; _user_id: string }
        Returns: string
      }
      transfer_project_responsibility: {
        Args: {
          _new_responsable_user_id: string
          _project_id: string
          _reason?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      acteur_type: "interne" | "externe"
      action_status:
        | "planifiee"
        | "en_cours"
        | "realisee"
        | "verifiee"
        | "cloturee"
        | "en_retard"
      action_type: "corrective" | "preventive" | "amelioration"
      app_role:
        | "rmq"
        | "responsable_processus"
        | "consultant"
        | "auditeur"
        | "admin"
        | "acteur"
        | "super_admin"
        | "dg"
      audit_status: "planifie" | "en_cours" | "termine" | "cloture"
      audit_type: "interne" | "externe"
      context_issue_type: "interne" | "externe"
      document_type:
        | "procedure"
        | "instruction"
        | "formulaire"
        | "enregistrement"
        | "rapport"
        | "compte_rendu_audit"
        | "preuve"
        | "image"
      finding_type:
        | "conformite"
        | "observation"
        | "non_conformite_mineure"
        | "non_conformite_majeure"
        | "amelioration"
      impact_level: "faible" | "moyen" | "fort"
      indicator_frequency:
        | "quotidien"
        | "hebdomadaire"
        | "mensuel"
        | "trimestriel"
        | "semestriel"
        | "annuel"
      indicator_type: "activite" | "resultat" | "perception" | "interne"
      nc_severity: "mineure" | "majeure" | "critique"
      nc_status:
        | "ouverte"
        | "en_traitement"
        | "cloturee"
        | "correction"
        | "analyse_cause"
        | "action_corrective"
        | "verification"
      process_element_type:
        | "finalite"
        | "donnee_entree"
        | "donnee_sortie"
        | "activite"
        | "interaction"
        | "partie_prenante"
        | "ressource"
      process_status: "brouillon" | "en_validation" | "valide" | "archive"
      process_type: "pilotage" | "realisation" | "support"
      risk_type: "risque" | "opportunite"
      task_flow_type: "sequentiel" | "conditionnel" | "parallele" | "inclusif"
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
      acteur_type: ["interne", "externe"],
      action_status: [
        "planifiee",
        "en_cours",
        "realisee",
        "verifiee",
        "cloturee",
        "en_retard",
      ],
      action_type: ["corrective", "preventive", "amelioration"],
      app_role: [
        "rmq",
        "responsable_processus",
        "consultant",
        "auditeur",
        "admin",
        "acteur",
        "super_admin",
        "dg",
      ],
      audit_status: ["planifie", "en_cours", "termine", "cloture"],
      audit_type: ["interne", "externe"],
      context_issue_type: ["interne", "externe"],
      document_type: [
        "procedure",
        "instruction",
        "formulaire",
        "enregistrement",
        "rapport",
        "compte_rendu_audit",
        "preuve",
        "image",
      ],
      finding_type: [
        "conformite",
        "observation",
        "non_conformite_mineure",
        "non_conformite_majeure",
        "amelioration",
      ],
      impact_level: ["faible", "moyen", "fort"],
      indicator_frequency: [
        "quotidien",
        "hebdomadaire",
        "mensuel",
        "trimestriel",
        "semestriel",
        "annuel",
      ],
      indicator_type: ["activite", "resultat", "perception", "interne"],
      nc_severity: ["mineure", "majeure", "critique"],
      nc_status: [
        "ouverte",
        "en_traitement",
        "cloturee",
        "correction",
        "analyse_cause",
        "action_corrective",
        "verification",
      ],
      process_element_type: [
        "finalite",
        "donnee_entree",
        "donnee_sortie",
        "activite",
        "interaction",
        "partie_prenante",
        "ressource",
      ],
      process_status: ["brouillon", "en_validation", "valide", "archive"],
      process_type: ["pilotage", "realisation", "support"],
      risk_type: ["risque", "opportunite"],
      task_flow_type: ["sequentiel", "conditionnel", "parallele", "inclusif"],
    },
  },
} as const
