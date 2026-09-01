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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_profile_roles: {
        Row: {
          admin_profile_id: string
          role_id: string
        }
        Insert: {
          admin_profile_id: string
          role_id: string
        }
        Update: {
          admin_profile_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_profile_roles_admin_profile_id_fkey"
            columns: ["admin_profile_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_profile_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_profile_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          admin_profile_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          admin_profile_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_admin_profile_id_fkey"
            columns: ["admin_profile_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          display_order: number | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          auth_user_id: string | null
          created_at: string
          document_number: string | null
          document_type: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          tax_condition: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          tax_condition?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          tax_condition?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          product_name_snapshot: string
          quantity: number
          sku_snapshot: string | null
          subtotal: number
          unit_cost_snapshot: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name_snapshot: string
          quantity: number
          sku_snapshot?: string | null
          subtotal: number
          unit_cost_snapshot: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          product_name_snapshot?: string
          quantity?: number
          sku_snapshot?: string | null
          subtotal?: number
          unit_cost_snapshot?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          order_number: string
          payment_confirmed_at: string | null
          payment_method: string
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          order_number: string
          payment_confirmed_at?: string | null
          payment_method?: string
          status?: string
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          order_number?: string
          payment_confirmed_at?: string | null
          payment_method?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          id: string
          module: string
        }
        Insert: {
          action: string
          id?: string
          module: string
        }
        Update: {
          action?: string
          id?: string
          module?: string
        }
        Relationships: []
      }
      product_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          product_id: string | null
          search_term: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          product_id?: string | null
          search_term?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          product_id?: string | null
          search_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          position: number
          product_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          position?: number
          product_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          position?: number
          product_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          author: string | null
          available: boolean
          barcode: string | null
          brand: string | null
          category_id: string
          cost: number
          created_at: string
          featured_order: number | null
          full_description: string | null
          id: string
          internal_code: string | null
          is_featured: boolean
          is_new: boolean
          is_published: boolean
          isbn: string | null
          margin_percent: number | null
          name: string
          price: number
          profit: number | null
          publisher: string | null
          sale_price: number | null
          short_description: string | null
          sku: string | null
          slug: string | null
          tags: string[] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          author?: string | null
          available?: boolean
          barcode?: string | null
          brand?: string | null
          category_id: string
          cost?: number
          created_at?: string
          featured_order?: number | null
          full_description?: string | null
          id?: string
          internal_code?: string | null
          is_featured?: boolean
          is_new?: boolean
          is_published?: boolean
          isbn?: string | null
          margin_percent?: number | null
          name: string
          price: number
          profit?: number | null
          publisher?: string | null
          sale_price?: number | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          tags?: string[] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          author?: string | null
          available?: boolean
          barcode?: string | null
          brand?: string | null
          category_id?: string
          cost?: number
          created_at?: string
          featured_order?: number | null
          full_description?: string | null
          id?: string
          internal_code?: string | null
          is_featured?: boolean
          is_new?: boolean
          is_published?: boolean
          isbn?: string | null
          margin_percent?: number | null
          name?: string
          price?: number
          profit?: number | null
          publisher?: string | null
          sale_price?: number | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          tags?: string[] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          is_super_admin: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_super_admin?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_super_admin?: boolean
          name?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          address: string | null
          business_hours: string | null
          business_name: string | null
          email: string | null
          hero_cta_link: string | null
          hero_cta_text: string | null
          hero_image_url: string | null
          hero_text: string | null
          hero_title: string | null
          id: number
          legal_name: string | null
          logo_url: string | null
          phone: string | null
          pickup_instructions_text: string | null
          store_enabled: boolean
          tax_id: string | null
          transfer_account_holder: string | null
          transfer_alias: string | null
          transfer_bank_or_wallet: string | null
          transfer_cbu_cvu: string | null
          transfer_instructions: string | null
          updated_at: string
          whatsapp_general_message: string | null
          whatsapp_number: string | null
          whatsapp_receipt_template: string | null
          whatsapp_shipping_inquiry_template: string | null
        }
        Insert: {
          address?: string | null
          business_hours?: string | null
          business_name?: string | null
          email?: string | null
          hero_cta_link?: string | null
          hero_cta_text?: string | null
          hero_image_url?: string | null
          hero_text?: string | null
          hero_title?: string | null
          id?: number
          legal_name?: string | null
          logo_url?: string | null
          phone?: string | null
          pickup_instructions_text?: string | null
          store_enabled?: boolean
          tax_id?: string | null
          transfer_account_holder?: string | null
          transfer_alias?: string | null
          transfer_bank_or_wallet?: string | null
          transfer_cbu_cvu?: string | null
          transfer_instructions?: string | null
          updated_at?: string
          whatsapp_general_message?: string | null
          whatsapp_number?: string | null
          whatsapp_receipt_template?: string | null
          whatsapp_shipping_inquiry_template?: string | null
        }
        Update: {
          address?: string | null
          business_hours?: string | null
          business_name?: string | null
          email?: string | null
          hero_cta_link?: string | null
          hero_cta_text?: string | null
          hero_image_url?: string | null
          hero_text?: string | null
          hero_title?: string | null
          id?: number
          legal_name?: string | null
          logo_url?: string | null
          phone?: string | null
          pickup_instructions_text?: string | null
          store_enabled?: boolean
          tax_id?: string | null
          transfer_account_holder?: string | null
          transfer_alias?: string | null
          transfer_bank_or_wallet?: string | null
          transfer_cbu_cvu?: string | null
          transfer_instructions?: string | null
          updated_at?: string
          whatsapp_general_message?: string | null
          whatsapp_number?: string | null
          whatsapp_receipt_template?: string | null
          whatsapp_shipping_inquiry_template?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      public_products: {
        Row: {
          author: string | null
          available: boolean | null
          barcode: string | null
          brand: string | null
          category_id: string | null
          created_at: string | null
          featured_order: number | null
          full_description: string | null
          id: string | null
          internal_code: string | null
          is_featured: boolean | null
          is_new: boolean | null
          is_published: boolean | null
          isbn: string | null
          name: string | null
          price: number | null
          publisher: string | null
          sale_price: number | null
          short_description: string | null
          sku: string | null
          slug: string | null
          tags: string[] | null
        }
        Insert: {
          author?: string | null
          available?: boolean | null
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string | null
          featured_order?: number | null
          full_description?: string | null
          id?: string | null
          internal_code?: string | null
          is_featured?: boolean | null
          is_new?: boolean | null
          is_published?: boolean | null
          isbn?: string | null
          name?: string | null
          price?: number | null
          publisher?: string | null
          sale_price?: number | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          tags?: string[] | null
        }
        Update: {
          author?: string | null
          available?: boolean | null
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string | null
          featured_order?: number | null
          full_description?: string | null
          id?: string | null
          internal_code?: string | null
          is_featured?: boolean | null
          is_new?: boolean | null
          is_published?: boolean | null
          isbn?: string | null
          name?: string | null
          price?: number | null
          publisher?: string | null
          sale_price?: number | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_guest_order: {
        Args: {
          p_email: string
          p_first_name: string
          p_items: Json
          p_last_name: string
          p_phone: string
        }
        Returns: {
          order_number: string
        }[]
      }
      get_my_admin_profile: {
        Args: never
        Returns: {
          full_name: string
          id: string
          is_active: boolean
          role_names: string[]
        }[]
      }
      has_permission: {
        Args: { p_action: string; p_module: string; p_user_id: string }
        Returns: boolean
      }
      is_product_visible: { Args: { p_product_id: string }; Returns: boolean }
      is_super_admin: { Args: { p_user_id: string }; Returns: boolean }
      next_order_number: { Args: never; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
