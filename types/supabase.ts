export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      spatial_features: {
        Row: {
          id: string
          geom: any // PostGIS geometry type
          properties: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          geom: any
          properties: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          geom?: any
          properties?: Json
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}