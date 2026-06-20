import { supabaseAdmin } from "../config/supabase.js";
import { cleanText } from "../utils/text.js";

export const candidateFields = [
  ["applicationNumber", "application_number"],
  ["name", "full_name"],
  ["dob", "date_of_birth"],
  ["attendance", "attendance"],
  ["joinReason", "join_reason"],
  ["primaryDepartment", "primary_department"],
  ["secondaryDepartment", "secondary_department"],
  ["otherSocieties", "other_societies"],
  ["recruitReason", "recruit_reason"],
];

export function isMissingCandidateTableError(error) {
  const message = (error?.message || "").toLowerCase();
  return (
    error?.code === "42P01" ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

export function mapCandidatePayload(body = {}, user) {
  return candidateFields.reduce(
    (payload, [sourceKey, targetKey]) => ({
      ...payload,
      [targetKey]: cleanText(body[sourceKey]),
    }),
    { user_id: user.id, email: user.email },
  );
}

export function validateCandidatePayload(body = {}) {
  return candidateFields
    .map(([sourceKey]) => sourceKey)
    .filter((field) => !cleanText(body[field]));
}

export async function findCandidateByUserId(userId) {
  return supabaseAdmin
    .from("candidate_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
}

export async function upsertCandidateProfile(payload) {
  return supabaseAdmin
    .from("candidate_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();
}
