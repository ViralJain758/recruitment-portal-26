import { supabaseAdmin, supabaseAuth } from "../config/supabase.js";

export function createUser(email, password) {
  return supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
}

export function getUserByToken(token) {
  return supabaseAuth.auth.getUser(token);
}

export function signIn(email, password) {
  return supabaseAuth.auth.signInWithPassword({ email, password });
}
