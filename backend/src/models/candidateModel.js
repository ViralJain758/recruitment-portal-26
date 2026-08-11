import db from "../config/db.js";
import { cleanText } from "../utils/text.js";

export const candidateFields = [
  ["applicationNumber", "application_number"],
  ["name", "full_name"],
  ["dob", "date_of_birth"],
  ["phoneNumber", "phone_number"],
  ["attendance", "attendance"],
  ["domainExperience", "domain_experience"],
  ["joinReason", "join_reason"],
  ["primaryDepartment", "primary_department"],
  ["secondaryDepartment", "secondary_department"],
  ["otherSocieties", "other_societies"],
  ["recruitReason", "recruit_reason"],
];

const APPLICATION_NUMBER_PATTERN = /^\d{6}$/;

export function validateCandidatePayload(body = {}) {
  return candidateFields
    .map(([sourceKey]) => sourceKey)
    .filter((field) => !cleanText(body[field]));
}

// Application number must be exactly 6 digits — no more, no fewer.
export function isValidApplicationNumber(value) {
  const cleaned = cleanText(value);
  return cleaned !== null && APPLICATION_NUMBER_PATTERN.test(cleaned);
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

// ── Full candidate view (JOIN all 4 tables) ───────────────────────────────────

const FULL_SELECT = `
  SELECT
    cp.id, cp.user_id, cp.email, cp.application_number, cp.full_name, cp.date_of_birth,
    cp.created_at, cp.updated_at,
    cf.phone_number, cf.attendance, cf.domain_experience, cf.join_reason,
    cf.primary_department, cf.secondary_department, cf.other_societies,
    cf.recruit_reason,
    cs.application_status, cs.form_locked, cs.individual_unlock, cs.slot_id,
    s.slot_day, s.slot_number, s.slot_venue, s.is_active AS slot_is_active,
    d.slot_date, t.start_time,
    cq.qr_token, cq.quiz_attended, cq.quiz_attended_at, cq.quiz_score, cq.quiz_submitted_at, cq.quiz_attempt_count
  FROM candidate_profiles cp
  LEFT JOIN candidate_form   cf ON cf.candidate_id = cp.id
  LEFT JOIN candidate_status cs ON cs.candidate_id = cp.id
  LEFT JOIN candidate_quiz   cq ON cq.candidate_id = cp.id
  LEFT JOIN slots             s ON s.id = cs.slot_id
  LEFT JOIN slot_day_dates    d ON d.day_number = s.slot_day
  LEFT JOIN slot_time_schedules t ON t.slot_number = s.slot_number
`;

export async function findCandidateByUserId(userId) {
  try {
    const result = await db.execute({
      sql: `${FULL_SELECT} WHERE cp.user_id = ?`,
      args: [userId],
    });
    return { data: result.rows[0] ?? null, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function findCandidateById(id) {
  try {
    const result = await db.execute({
      sql: `${FULL_SELECT} WHERE cp.id = ?`,
      args: [id],
    });
    return { data: result.rows[0] ?? null, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function findAllCandidates() {
  const result = await db.execute(`${FULL_SELECT} ORDER BY cp.created_at DESC`);
  return result.rows;
}

// ── Upsert — inserts/updates across all 4 tables atomically ──────────────────

export async function upsertCandidateProfile(payload) {
  const {
    user_id,
    email,
    application_number,
    full_name,
    date_of_birth,
    phone_number,
    attendance,
    domain_experience,
    join_reason,
    primary_department,
    secondary_department,
    other_societies,
    recruit_reason,
  } = payload;

  try {
    // 1. Core profile
    await db.execute({
      sql: `INSERT INTO candidate_profiles (user_id, email, application_number, full_name, date_of_birth)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (user_id) DO UPDATE SET
              email = excluded.email,
              application_number = excluded.application_number,
              full_name = excluded.full_name,
              date_of_birth = excluded.date_of_birth,
              updated_at = datetime('now')`,
      args: [user_id, email, application_number, full_name, date_of_birth],
    });

    // Get the candidate id
    const cpRow = await db.execute({
      sql: "SELECT id FROM candidate_profiles WHERE user_id = ?",
      args: [user_id],
    });
    const candidateId = cpRow.rows[0].id;

    // 2. Form answers
    await db.execute({
      sql: `INSERT INTO candidate_form
              (candidate_id, phone_number, attendance, domain_experience, join_reason, primary_department, secondary_department, other_societies, recruit_reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (candidate_id) DO UPDATE SET
              phone_number = excluded.phone_number,
              attendance = excluded.attendance,
              domain_experience = excluded.domain_experience,
              join_reason = excluded.join_reason,
              primary_department = excluded.primary_department,
              secondary_department = excluded.secondary_department,
              other_societies = excluded.other_societies,
              recruit_reason = excluded.recruit_reason,
              updated_at = datetime('now')`,
      args: [
        candidateId,
        phone_number,
        attendance,
        domain_experience,
        join_reason,
        primary_department,
        secondary_department,
        other_societies,
        recruit_reason,
      ],
    });

    // 3. Status row (create if not exists)
    await db.execute({
      sql: `INSERT INTO candidate_status (candidate_id) VALUES (?)
            ON CONFLICT (candidate_id) DO NOTHING`,
      args: [candidateId],
    });

    // 4. Quiz row (create if not exists)
    await db.execute({
      sql: `INSERT INTO candidate_quiz (candidate_id) VALUES (?)
            ON CONFLICT (candidate_id) DO NOTHING`,
      args: [candidateId],
    });

    // Return full joined row
    const result = await db.execute({
      sql: `${FULL_SELECT} WHERE cp.id = ?`,
      args: [candidateId],
    });

    return { data: result.rows[0], error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}
