// ── NOT CURRENTLY USED ──────────────────────────────────────────────────
// Nothing in this codebase imports supabaseAuth/supabaseAdmin — the app's
// actual database is Turso/libSQL (see ./db.js). This file is left over
// from an earlier iteration and requires SUPABASE_URL / SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY env vars that aren't in .env.example.
//
// If this is genuinely unused, delete it — an unused client wired to a
// service-role key (which bypasses Row Level Security) is a needless
// secret to manage and an easy thing to accidentally import somewhere
// without realizing it has elevated privileges. If it *is* still needed,
// make sure the service-role key is only ever used server-side (never
// shipped to the frontend) and treat it with the same care as the other
// secrets in this directory: platform secret store only, never committed.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase environment variables.");
}

export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
