import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// =========================
// 🔐 ENV VARIABLES (SAFE LOAD)
// =========================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// =========================
// ⚠️ SAFETY CHECK (VERY IMPORTANT)
// =========================
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Missing Supabase environment variables. Check your .env file."
  );
}

// =========================
// 🧠 DEBUG (REMOVE IN PROD)
// =========================
console.log("✅ Supabase URL:", SUPABASE_URL);

// =========================
// 🚀 CREATE CLIENT
// =========================
export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      storage: localStorage,     // persist login
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,  // OAuth support
    },
  }
);