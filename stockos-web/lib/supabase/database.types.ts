export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          owner_id: string
          plan: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          plan?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          plan?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          org_id: string
          user_id: string
          role: string
          invited_by: string | null
          invited_at: string | null
          joined_at: string | null
          status: string | null
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          role: string
          invited_by?: string | null
          invited_at?: string | null
          joined_at?: string | null
          status?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          role?: string
          invited_by?: string | null
          invited_at?: string | null
          joined_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          id: string
          org_id: string
          email: string
          role: string
          token: string
          invited_by: string
          expires_at: string | null
          accepted_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          email: string
          role: string
          token?: string
          invited_by: string
          expires_at?: string | null
          accepted_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          email?: string
          role?: string
          token?: string
          invited_by?: string
          expires_at?: string | null
          accepted_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          company_name: string | null
          company_gstin: string | null
          company_address: string | null
          company_phone: string | null
          logo_url: string | null
          timezone: string | null
          created_at: string | null
          updated_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          full_name?: string | null
          company_name?: string | null
          company_gstin?: string | null
          company_address?: string | null
          company_phone?: string | null
          logo_url?: string | null
          timezone?: string | null
          created_at?: string | null
          updated_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          full_name?: string | null
          company_name?: string | null
          company_gstin?: string | null
          company_address?: string | null
          company_phone?: string | null
          logo_url?: string | null
          timezone?: string | null
          created_at?: string | null
          updated_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          id: string
          user_id: string
          name: string
          code: string
          type: string
          address: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          code: string
          type: string
          address?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          code?: string
          type?: string
          address?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          id: string
          user_id: string
          standardized_name: string
          product_code: string
          brand: string | null
          category: string
          packaging_type: string | null
          packaging_size: string | null
          unit: string | null
          min_stock_level: number | null
          specifications: Json | null
          image_url: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          standardized_name: string
          product_code: string
          brand?: string | null
          category: string
          packaging_type?: string | null
          packaging_size?: string | null
          unit?: string | null
          min_stock_level?: number | null
          specifications?: Json | null
          image_url?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          standardized_name?: string
          product_code?: string
          brand?: string | null
          category?: string
          packaging_type?: string | null
          packaging_size?: string | null
          unit?: string | null
          min_stock_level?: number | null
          specifications?: Json | null
          image_url?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          id: string
          user_id: string
          location_id: string
          item_id: string
          quantity: number | null
          reserved_qty: number | null
          unit_cost: number | null
          updated_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          location_id: string
          item_id: string
          quantity?: number | null
          reserved_qty?: number | null
          unit_cost?: number | null
          updated_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          location_id?: string
          item_id?: string
          quantity?: number | null
          reserved_qty?: number | null
          unit_cost?: number | null
          updated_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      stock_ledger: {
        Row: {
          id: string
          user_id: string
          location_id: string
          item_id: string
          movement_type: string
          quantity: number
          balance_after: number
          unit_cost: number | null
          reference_type: string | null
          reference_id: string | null
          notes: string | null
          created_by: string | null
          created_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          location_id: string
          item_id: string
          movement_type: string
          quantity: number
          balance_after: number
          unit_cost?: number | null
          reference_type?: string | null
          reference_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          location_id?: string
          item_id?: string
          movement_type?: string
          quantity?: number
          balance_after?: number
          unit_cost?: number | null
          reference_type?: string | null
          reference_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      stock_adjustments: {
        Row: {
          id: string
          user_id: string
          item_id: string
          location_id: string
          quantity: number
          adjustment_type: string
          reason: string
          notes: string | null
          status: string | null
          approved_by: string | null
          approved_at: string | null
          created_by: string | null
          created_at: string | null
          org_id: string
          rejection_reason: string | null
        }
        Insert: {
          id?: string
          user_id: string
          item_id: string
          location_id: string
          quantity: number
          adjustment_type: string
          reason: string
          notes?: string | null
          status?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_by?: string | null
          created_at?: string | null
          org_id?: string
          rejection_reason?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          item_id?: string
          location_id?: string
          quantity?: number
          adjustment_type?: string
          reason?: string
          notes?: string | null
          status?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_by?: string | null
          created_at?: string | null
          org_id?: string
          rejection_reason?: string | null
        }
        Relationships: []
      }
      move_orders: {
        Row: {
          id: string
          user_id: string
          order_number: string
          type: string
          status: string | null
          from_location_id: string | null
          to_location_id: string | null
          dispatched_at: string | null
          completed_at: string | null
          notes: string | null
          created_by: string | null
          approved_by: string | null
          created_at: string | null
          updated_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          order_number: string
          type: string
          status?: string | null
          from_location_id?: string | null
          to_location_id?: string | null
          dispatched_at?: string | null
          completed_at?: string | null
          notes?: string | null
          created_by?: string | null
          approved_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          order_number?: string
          type?: string
          status?: string | null
          from_location_id?: string | null
          to_location_id?: string | null
          dispatched_at?: string | null
          completed_at?: string | null
          notes?: string | null
          created_by?: string | null
          approved_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      move_order_lines: {
        Row: {
          id: string
          user_id: string
          move_order_id: string
          item_id: string
          requested_qty: number
          dispatched_qty: number | null
          received_qty: number | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          move_order_id: string
          item_id: string
          requested_qty: number
          dispatched_qty?: number | null
          received_qty?: number | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          move_order_id?: string
          item_id?: string
          requested_qty?: number
          dispatched_qty?: number | null
          received_qty?: number | null
          org_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          id: string
          user_id: string
          vendor_id_display: string
          company_name: string
          gstin: string | null
          pan: string | null
          payment_terms: string | null
          credit_limit: number | null
          remarks: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          vendor_id_display: string
          company_name: string
          gstin?: string | null
          pan?: string | null
          payment_terms?: string | null
          credit_limit?: number | null
          remarks?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          vendor_id_display?: string
          company_name?: string
          gstin?: string | null
          pan?: string | null
          payment_terms?: string | null
          credit_limit?: number | null
          remarks?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      vendor_contacts: {
        Row: {
          id: string
          user_id: string
          vendor_id: string
          name: string
          role: string | null
          phones: string[] | null
          email: string | null
          is_primary: boolean | null
          created_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          vendor_id: string
          name: string
          role?: string | null
          phones?: string[] | null
          email?: string | null
          is_primary?: boolean | null
          created_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          vendor_id?: string
          name?: string
          role?: string | null
          phones?: string[] | null
          email?: string | null
          is_primary?: boolean | null
          created_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      vendor_items: {
        Row: {
          id: string
          user_id: string
          vendor_id: string
          item_id: string
          unit_price: number | null
          lead_time_days: number | null
          is_preferred: boolean | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          vendor_id: string
          item_id: string
          unit_price?: number | null
          lead_time_days?: number | null
          is_preferred?: boolean | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          vendor_id?: string
          item_id?: string
          unit_price?: number | null
          lead_time_days?: number | null
          is_preferred?: boolean | null
          org_id?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          id: string
          user_id: string
          po_number: string
          vendor_id: string
          status: string | null
          expected_date: string | null
          total_amount: number | null
          received_amount: number | null
          notes: string | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          po_number: string
          vendor_id: string
          status?: string | null
          expected_date?: string | null
          total_amount?: number | null
          received_amount?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          po_number?: string
          vendor_id?: string
          status?: string | null
          expected_date?: string | null
          total_amount?: number | null
          received_amount?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      purchase_order_lines: {
        Row: {
          id: string
          user_id: string
          purchase_order_id: string
          item_id: string
          ordered_qty: number
          received_qty: number | null
          unit_price: number
          batch_number: string | null
          expiry_date: string | null
          location_id: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          purchase_order_id: string
          item_id: string
          ordered_qty: number
          received_qty?: number | null
          unit_price: number
          batch_number?: string | null
          expiry_date?: string | null
          location_id?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          purchase_order_id?: string
          item_id?: string
          ordered_qty?: number
          received_qty?: number | null
          unit_price?: number
          batch_number?: string | null
          expiry_date?: string | null
          location_id?: string | null
          org_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          user_id: string
          customer_id_display: string
          type: string | null
          company_name: string | null
          primary_contact: string
          phones: string[] | null
          address: string | null
          city: string | null
          state: string | null
          gstin: string | null
          pan: string | null
          credit_limit: number | null
          outstanding_balance: number | null
          payment_terms: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          customer_id_display: string
          type?: string | null
          company_name?: string | null
          primary_contact: string
          phones?: string[] | null
          address?: string | null
          city?: string | null
          state?: string | null
          gstin?: string | null
          pan?: string | null
          credit_limit?: number | null
          outstanding_balance?: number | null
          payment_terms?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          customer_id_display?: string
          type?: string | null
          company_name?: string | null
          primary_contact?: string
          phones?: string[] | null
          address?: string | null
          city?: string | null
          state?: string | null
          gstin?: string | null
          pan?: string | null
          credit_limit?: number | null
          outstanding_balance?: number | null
          payment_terms?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      customer_contacts: {
        Row: {
          id: string
          user_id: string
          customer_id: string
          name: string
          role: string | null
          phones: string[] | null
          email: string | null
          is_primary: boolean | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          customer_id: string
          name: string
          role?: string | null
          phones?: string[] | null
          email?: string | null
          is_primary?: boolean | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          customer_id?: string
          name?: string
          role?: string | null
          phones?: string[] | null
          email?: string | null
          is_primary?: boolean | null
          org_id?: string
        }
        Relationships: []
      }
      customer_activities: {
        Row: {
          id: string
          user_id: string
          customer_id: string
          type: string
          content: string
          created_by: string | null
          created_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          customer_id: string
          type: string
          content: string
          created_by?: string | null
          created_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          customer_id?: string
          type?: string
          content?: string
          created_by?: string | null
          created_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      sale_orders: {
        Row: {
          id: string
          user_id: string
          order_number: string
          customer_id: string
          status: string | null
          location_id: string | null
          total_amount: number | null
          amount_paid: number | null
          payment_status: string | null
          notes: string | null
          dispatched_at: string | null
          delivered_at: string | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          order_number: string
          customer_id: string
          status?: string | null
          location_id?: string | null
          total_amount?: number | null
          amount_paid?: number | null
          payment_status?: string | null
          notes?: string | null
          dispatched_at?: string | null
          delivered_at?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          order_number?: string
          customer_id?: string
          status?: string | null
          location_id?: string | null
          total_amount?: number | null
          amount_paid?: number | null
          payment_status?: string | null
          notes?: string | null
          dispatched_at?: string | null
          delivered_at?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      sale_order_lines: {
        Row: {
          id: string
          user_id: string
          sale_order_id: string
          item_id: string
          quantity: number
          unit_price: number
          total_price: number
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          sale_order_id: string
          item_id: string
          quantity: number
          unit_price: number
          total_price: number
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          sale_order_id?: string
          item_id?: string
          quantity?: number
          unit_price?: number
          total_price?: number
          org_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          user_id: string
          sale_order_id: string
          amount: number
          mode: string
          reference_no: string | null
          bank_name: string | null
          clearance_date: string | null
          notes: string | null
          received_by: string | null
          received_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          sale_order_id: string
          amount: number
          mode: string
          reference_no?: string | null
          bank_name?: string | null
          clearance_date?: string | null
          notes?: string | null
          received_by?: string | null
          received_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          sale_order_id?: string
          amount?: number
          mode?: string
          reference_no?: string | null
          bank_name?: string | null
          clearance_date?: string | null
          notes?: string | null
          received_by?: string | null
          received_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      delivery_challans: {
        Row: {
          id: string
          user_id: string
          challan_number: string
          sale_order_id: string
          from_address: string
          to_address: string
          vehicle_no: string | null
          driver_name: string | null
          driver_phone: string | null
          status: string | null
          pdf_url: string | null
          generated_at: string | null
          delivered_at: string | null
          created_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          challan_number: string
          sale_order_id: string
          from_address: string
          to_address: string
          vehicle_no?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          status?: string | null
          pdf_url?: string | null
          generated_at?: string | null
          delivered_at?: string | null
          created_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          challan_number?: string
          sale_order_id?: string
          from_address?: string
          to_address?: string
          vehicle_no?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          status?: string | null
          pdf_url?: string | null
          generated_at?: string | null
          delivered_at?: string | null
          created_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      boms: {
        Row: {
          id: string
          user_id: string
          finished_good_id: string
          version: string | null
          yield_qty: number | null
          yield_unit: string | null
          is_active: boolean | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          finished_good_id: string
          version?: string | null
          yield_qty?: number | null
          yield_unit?: string | null
          is_active?: boolean | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          finished_good_id?: string
          version?: string | null
          yield_qty?: number | null
          yield_unit?: string | null
          is_active?: boolean | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      bom_lines: {
        Row: {
          id: string
          user_id: string
          bom_id: string
          raw_material_id: string
          quantity: number
          unit: string
          waste_percent: number | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          bom_id: string
          raw_material_id: string
          quantity: number
          unit: string
          waste_percent?: number | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          bom_id?: string
          raw_material_id?: string
          quantity?: number
          unit?: string
          waste_percent?: number | null
          org_id?: string
        }
        Relationships: []
      }
      production_orders: {
        Row: {
          id: string
          user_id: string
          order_number: string
          bom_id: string
          target_qty: number
          actual_qty: number | null
          status: string | null
          deadline: string | null
          started_at: string | null
          completed_at: string | null
          batch_number: string | null
          yield_percent: number | null
          notes: string | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
          machine_id: string | null
          location_id: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          order_number: string
          bom_id: string
          target_qty: number
          actual_qty?: number | null
          status?: string | null
          deadline?: string | null
          started_at?: string | null
          completed_at?: string | null
          batch_number?: string | null
          yield_percent?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          machine_id?: string | null
          location_id?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          order_number?: string
          bom_id?: string
          target_qty?: number
          actual_qty?: number | null
          status?: string | null
          deadline?: string | null
          started_at?: string | null
          completed_at?: string | null
          batch_number?: string | null
          yield_percent?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          machine_id?: string | null
          location_id?: string | null
          org_id?: string
        }
        Relationships: []
      }
      production_material_lines: {
        Row: {
          id: string
          user_id: string
          production_order_id: string
          raw_material_id: string
          required_qty: number
          consumed_qty: number | null
          variance: number | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          production_order_id: string
          raw_material_id: string
          required_qty: number
          consumed_qty?: number | null
          variance?: number | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          production_order_id?: string
          raw_material_id?: string
          required_qty?: number
          consumed_qty?: number | null
          variance?: number | null
          org_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          id: string
          user_id: string
          entity_type: string
          entity_id: string
          file_name: string
          file_key: string
          file_url: string | null
          mime_type: string
          file_size_bytes: number | null
          uploaded_by: string | null
          uploaded_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          entity_type: string
          entity_id: string
          file_name: string
          file_key: string
          file_url?: string | null
          mime_type: string
          file_size_bytes?: number | null
          uploaded_by?: string | null
          uploaded_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          entity_type?: string
          entity_id?: string
          file_name?: string
          file_key?: string
          file_url?: string | null
          mime_type?: string
          file_size_bytes?: number | null
          uploaded_by?: string | null
          uploaded_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string
          action: string
          entity_type: string
          entity_id: string | null
          old_values: Json | null
          new_values: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          action: string
          entity_type: string
          entity_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          action?: string
          entity_type?: string
          entity_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      machines: {
        Row: {
          id: string
          user_id: string
          name: string
          code: string
          location_id: string | null
          status: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          code: string
          location_id?: string | null
          status?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          code?: string
          location_id?: string | null
          status?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      batches: {
        Row: {
          id: string
          user_id: string
          production_order_id: string
          batch_number: string
          quantity: number
          quality_status: string | null
          expiry_date: string | null
          notes: string | null
          created_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          production_order_id: string
          batch_number: string
          quantity: number
          quality_status?: string | null
          expiry_date?: string | null
          notes?: string | null
          created_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          production_order_id?: string
          batch_number?: string
          quantity?: number
          quality_status?: string | null
          expiry_date?: string | null
          notes?: string | null
          created_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      labour_entries: {
        Row: {
          id: string
          user_id: string
          production_order_id: string
          worker_name: string
          hours: number
          rate: number | null
          notes: string | null
          created_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          production_order_id: string
          worker_name: string
          hours: number
          rate?: number | null
          notes?: string | null
          created_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          production_order_id?: string
          worker_name?: string
          hours?: number
          rate?: number | null
          notes?: string | null
          created_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          link: string | null
          is_read: boolean | null
          created_at: string | null
          org_id: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body?: string | null
          link?: string | null
          is_read?: boolean | null
          created_at?: string | null
          org_id: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string | null
          link?: string | null
          is_read?: boolean | null
          created_at?: string | null
          org_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organization_invite: {
        Args: { p_token: string }
        Returns: Json
      }
      get_user_org_id: {
        Args: Record<string, never>
        Returns: string
      }
      get_user_org_role: {
        Args: Record<string, never>
        Returns: string
      }
      process_stock_movement: {
        Args: {
          p_user_id: string
          p_location_id: string
          p_item_id: string
          p_movement_type: string
          p_quantity: number
          p_unit_cost?: number | null
          p_reference_type?: string | null
          p_reference_id?: string | null
          p_notes?: string | null
          p_created_by?: string | null
        }
        Returns: Json
      }
      apply_stock_adjustment: {
        Args: {
          p_user_id: string
          p_adjustment_id: string
        }
        Returns: Json
      }
      reject_stock_adjustment: {
        Args: {
          p_user_id: string
          p_adjustment_id: string
          p_reason: string
        }
        Returns: Json
      }
      get_dashboard_kpis: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_low_stock_items: {
        Args: { p_user_id: string }
        Returns: {
          item_id: string
          item_name: string
          product_code: string
          category: string
          location_id: string
          location_name: string
          current_qty: number
          min_stock_level: number
          deficit: number
        }[]
      }
      generate_order_number: {
        Args: { p_user_id: string; p_prefix: string }
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

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
