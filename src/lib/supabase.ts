import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder",
  {
    auth: {
      // Bypass navigator.locks which can hang when tabs are suspended,
      // restored from bfcache, or when a lock is never released.
      lock: async (_name, _acquireTimeout, fn) => {
        return fn();
      },
    },
  }
);
