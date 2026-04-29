// lib/database.types.ts
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          password_hash: string;
          created_at: string;
        };
        Insert: {
          email: string;
          name?: string | null;
          password_hash: string;
        };
        Update: {
          email?: string;
          name?: string | null;
          password_hash?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
};
