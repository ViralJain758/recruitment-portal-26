import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";
import db from "../../src/config/db.js";

const candidateCount = Number.parseInt(process.env.LOAD_TEST_CANDIDATES || "1500", 10);
const outFile = process.env.LOAD_TEST_TOKENS_FILE || "scripts/load/quiz-load-users.json";
const emailDomain = process.env.LOAD_TEST_EMAIL_DOMAIN || "loadtest.local";
const runId = process.env.LOAD_TEST_RUN_ID || new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const slotDay = Number.parseInt(process.env.LOAD_TEST_SLOT_DAY || "99", 10);
const slotNumber = Number.parseInt(process.env.LOAD_TEST_SLOT_NUMBER || "1", 10);
const slotVenue = process.env.LOAD_TEST_SLOT_VENUE || "Load Test Lab";
const slotDate = process.env.LOAD_TEST_SLOT_DATE || "2026-08-08";
const startTime = process.env.LOAD_TEST_START_TIME || "10:00";
const jwtSecret = process.env.JWT_SECRET?.trim();

if (!jwtSecret) {
  throw new Error("JWT_SECRET is required to mint load-test access tokens.");
}

function chunk(rows, size = 100) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

async function batch(statements, mode = "write") {
  for (const part of chunk(statements)) {
    await db.batch(part, mode);
  }
}

async function seedSlot() {
  await db.batch(
    [
      {
        sql: `INSERT INTO slot_day_dates (day_number, slot_date)
              VALUES (?, ?)
              ON CONFLICT(day_number) DO UPDATE SET slot_date = excluded.slot_date`,
        args: [slotDay, slotDate],
      },
      {
        sql: `INSERT INTO slot_time_schedules (slot_number, start_time)
              VALUES (?, ?)
              ON CONFLICT(slot_number) DO UPDATE SET start_time = excluded.start_time`,
        args: [slotNumber, startTime],
      },
      {
        sql: `INSERT INTO slots (slot_day, slot_number, slot_venue, is_active)
              VALUES (?, ?, ?, 1)
              ON CONFLICT(slot_day, slot_number, slot_venue)
              DO UPDATE SET is_active = 1`,
        args: [slotDay, slotNumber, slotVenue],
      },
    ],
    "write",
  );

  const result = await db.execute({
    sql: "SELECT id FROM slots WHERE slot_day = ? AND slot_number = ? AND slot_venue = ?",
    args: [slotDay, slotNumber, slotVenue],
  });
  return result.rows[0]?.id;
}

async function seedQuestions() {
  const existing = await db.execute("SELECT COUNT(*) AS count FROM quiz_questions WHERE is_active = 1");
  if (Number(existing.rows[0]?.count || 0) >= 15) return;

  await batch(
    Array.from({ length: 15 }, (_, index) => ({
      sql: `INSERT INTO quiz_questions
            (external_id, section, question_text, options_json, correct_answer_index, display_order, is_active)
            VALUES (?, 'Load Test', ?, ?, 0, ?, 1)
            ON CONFLICT(external_id) DO UPDATE SET
              question_text = excluded.question_text,
              options_json = excluded.options_json,
              correct_answer_index = excluded.correct_answer_index,
              display_order = excluded.display_order,
              is_active = 1`,
      args: [
        `load-test-question-${index + 1}`,
        `Load-test question ${index + 1}?`,
        JSON.stringify(["A", "B", "C", "D"].map((value) => ({ type: "text", value }))),
        index + 1,
      ],
    })),
  );
}

await seedQuestions();
const slotId = await seedSlot();
if (!slotId) throw new Error("Failed to create/load the load-test slot.");

await db.execute({
  sql: "DELETE FROM users WHERE email LIKE ?",
  args: [`loadtest-%@${emailDomain}`],
});

const users = Array.from({ length: candidateCount }, (_, index) => {
  const n = index + 1;
  return {
    email: `loadtest-${runId}-${String(n).padStart(4, "0")}@${emailDomain}`,
    applicationNumber: `LT-${runId}-${String(n).padStart(4, "0")}`,
    name: `Load Test Candidate ${n}`,
  };
});

await batch(
  users.map((user) => ({
    sql: "INSERT INTO users (email, password, role, email_verified) VALUES (?, 'load-test-no-login', 'user', 1)",
    args: [user.email],
  })),
);

const placeholders = users.map(() => "?").join(",");
const userRows = await db.execute({
  sql: `SELECT id, email, role FROM users WHERE email IN (${placeholders})`,
  args: users.map((user) => user.email),
});
const byEmail = new Map(userRows.rows.map((row) => [row.email, row]));

await batch(
  users.map((user) => {
    const row = byEmail.get(user.email);
    return {
      sql: `INSERT INTO candidate_profiles (user_id, email, application_number, full_name, date_of_birth)
            VALUES (?, ?, ?, ?, '2000-01-01')`,
      args: [row.id, user.email, user.applicationNumber, user.name],
    };
  }),
);

const profileRows = await db.execute({
  sql: `SELECT id, email FROM candidate_profiles WHERE email IN (${placeholders})`,
  args: users.map((user) => user.email),
});
const profileByEmail = new Map(profileRows.rows.map((row) => [row.email, row]));

await batch(
  users.map((user) => {
    const profile = profileByEmail.get(user.email);
    return {
      sql: `INSERT INTO candidate_form
            (candidate_id, phone_number, attendance, domain_experience, join_reason, primary_department, secondary_department, other_societies, recruit_reason)
            VALUES (?, '9999999999', 'Yes', 'Load test', 'Load test', 'Technical', 'Management', 'None', 'Load test')`,
      args: [profile.id],
    };
  }),
);

await batch(
  users.map((user) => {
    const profile = profileByEmail.get(user.email);
    return {
      sql: `INSERT INTO candidate_status (candidate_id, application_status, slot_id)
            VALUES (?, 'Shortlisted', ?)
            ON CONFLICT(candidate_id) DO UPDATE SET slot_id = excluded.slot_id`,
      args: [profile.id, slotId],
    };
  }),
);

await batch(
  users.map((user) => {
    const profile = profileByEmail.get(user.email);
    return {
      sql: `INSERT INTO candidate_quiz (candidate_id, quiz_attended, quiz_score, quiz_submitted_at, quiz_attempt_count)
            VALUES (?, 0, NULL, NULL, 0)
            ON CONFLICT(candidate_id) DO UPDATE SET
              quiz_attended = 0,
              quiz_score = NULL,
              quiz_submitted_at = NULL,
              quiz_attempt_count = 0`,
      args: [profile.id],
    };
  }),
);

const output = users.map((user) => {
  const row = byEmail.get(user.email);
  return {
    email: user.email,
    applicationNumber: user.applicationNumber,
    token: jwt.sign({ id: row.id, email: row.email, role: row.role }, jwtSecret, { expiresIn: "2h" }),
  };
});

await fs.mkdir(path.dirname(outFile), { recursive: true });
await fs.writeFile(outFile, JSON.stringify(output, null, 2));

console.log(JSON.stringify({
  seededCandidates: output.length,
  slotId,
  runId,
  outFile,
}));
