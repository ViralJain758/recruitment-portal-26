import db from "../config/db.js";
import { findAllCandidates, findCandidateById } from "../models/candidateModel.js";

// ── Candidates ─────────────────────────────────────────────────────────────

export async function fetchAllCandidates() {
  return findAllCandidates();
}

export async function updateStatus(id, status) {
  // id is candidate_profiles.id — candidate_status.candidate_id references it
  await db.execute({
    sql: `UPDATE candidate_status SET application_status = ?, updated_at = datetime('now')
          WHERE candidate_id = ?`,
    args: [status, id],
  });
  const { data } = await findCandidateById(id);
  if (!data) throw new Error("Candidate not found.");
  return data;
}

export async function updateAttendance(id, present) {
  // id is candidate_profiles.id
  const attendedAt = present ? new Date().toISOString() : null;
  await db.execute({
    sql: `UPDATE candidate_quiz
          SET quiz_attended = ?, quiz_attended_at = ?, updated_at = datetime('now')
          WHERE candidate_id = ?`,
    args: [present ? 1 : 0, attendedAt, id],
  });
  const { data } = await findCandidateById(id);
  if (!data) throw new Error("Candidate not found.");
  return data;
}

export async function deleteCandidate(id) {
  // FIX (Bug 1): Resolve the user_id first, then delete refresh_tokens explicitly
  // before removing the user row. Although the schema has ON DELETE CASCADE on
  // refresh_tokens.user_id, explicitly deleting them first guarantees the email
  // is fully free for re-registration even if Turso's cascade has any lag.
  // We use db.batch() so all statements run atomically.

  const cpRow = await db.execute({
    sql: "SELECT user_id FROM candidate_profiles WHERE id = ?",
    args: [id],
  });

  const userId = cpRow.rows[0]?.user_id;
  if (!userId) throw new Error("Candidate not found.");

  await db.batch(
    [
      // Explicitly revoke all refresh tokens so the deleted user cannot refresh
      { sql: "DELETE FROM refresh_tokens WHERE user_id = ?", args: [userId] },
      // Deleting from users cascades: candidate_profiles, candidate_form,
      // candidate_status, candidate_quiz (all have ON DELETE CASCADE).
      { sql: "DELETE FROM users WHERE id = ?", args: [userId] },
    ],
    "write",
  );
}

// ── QR Attendance ──────────────────────────────────────────────────────────

const QR_UNLOCK_MINUTES_BEFORE = 30;

async function resolveCandidateSlotDateTime(slotId) {
  if (!slotId) return null;

  const slotResult = await db.execute({
    sql: "SELECT slot_day, slot_number FROM slots WHERE id = ?",
    args: [slotId],
  });
  const slot = slotResult.rows[0];
  if (!slot) return null;

  const [dayResult, timeResult] = await Promise.all([
    db.execute({ sql: "SELECT slot_date FROM slot_day_dates WHERE day_number = ?", args: [slot.slot_day] }),
    db.execute({ sql: "SELECT start_time FROM slot_time_schedules WHERE slot_number = ?", args: [slot.slot_number] }),
  ]);

  const slotDate = dayResult.rows[0]?.slot_date;
  const startTime = timeResult.rows[0]?.start_time;
  if (!slotDate || !startTime) return null;

  // FIX: new Date("YYYY-MM-DDTHH:MM") with no timezone suffix is parsed as UTC
  // by the JS engine. Slot times are entered in IST (UTC+5:30), so appending
  // the IST offset makes the Date represent the correct instant in time.
  // Without this, a 10:00 AM IST slot is treated as 10:00 AM UTC (3:30 PM IST),
  // causing the unlock window check to fire ~5h30m too late.
  const IST_OFFSET = "+05:30";
  const dt = new Date(`${slotDate}T${startTime}${IST_OFFSET}`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export async function markQuizAttendance(qrToken) {
  const result = await db.execute({
    sql: `SELECT cp.id, cq.quiz_attended, cs.slot_id
          FROM candidate_quiz cq
          JOIN candidate_profiles cp ON cp.id = cq.candidate_id
          LEFT JOIN candidate_status cs ON cs.candidate_id = cp.id
          WHERE cq.qr_token = ?`,
    args: [qrToken],
  });

  const row = result.rows[0];
  if (!row) throw new Error("Candidate not found");

  if (row.quiz_attended) {
    const { data } = await findCandidateById(row.id);
    return { alreadyPresent: true, candidate: data };
  }

  const slotDateTime = await resolveCandidateSlotDateTime(row.slot_id);
  if (slotDateTime) {
    const unlockAt = new Date(slotDateTime.getTime() - QR_UNLOCK_MINUTES_BEFORE * 60_000);
    if (new Date() < unlockAt) {
      throw new Error(
        `This QR code is not valid yet. It unlocks ${QR_UNLOCK_MINUTES_BEFORE} minutes before the candidate's slot.`
      );
    }
  }

  await db.execute({
    sql: `UPDATE candidate_quiz
          SET quiz_attended = 1, quiz_attended_at = ?, updated_at = datetime('now')
          WHERE candidate_id = ?`,
    args: [new Date().toISOString(), row.id],
  });

  const { data } = await findCandidateById(row.id);
  return { alreadyPresent: false, candidate: data };
}

export async function getAttendanceStatsService() {
  const [total, present] = await Promise.all([
    db.execute("SELECT COUNT(*) as count FROM candidate_profiles"),
    db.execute("SELECT COUNT(*) as count FROM candidate_quiz WHERE quiz_attended = 1"),
  ]);
  return {
    totalCandidates: Number(total.rows[0].count),
    presentCandidates: Number(present.rows[0].count),
  };
}

// ── Form lock ──────────────────────────────────────────────────────────────

export async function toggleFormLock(id, locked) {
  // id is candidate_profiles.id
  await db.execute({
    sql: `UPDATE candidate_status
          SET form_locked = ?, individual_unlock = 0, updated_at = datetime('now')
          WHERE candidate_id = ?`,
    args: [locked ? 1 : 0, id],
  });
  const { data } = await findCandidateById(id);
  if (!data) throw new Error("Candidate not found.");
  return data;
}

export async function setIndividualUnlock(id, unlocked) {
  // id is candidate_profiles.id
  const sql = unlocked
    ? `UPDATE candidate_status SET individual_unlock = 1, form_locked = 0, updated_at = datetime('now') WHERE candidate_id = ?`
    : `UPDATE candidate_status SET individual_unlock = 0, updated_at = datetime('now') WHERE candidate_id = ?`;
  await db.execute({ sql, args: [id] });
  const { data } = await findCandidateById(id);
  if (!data) throw new Error("Candidate not found.");
  return data;
}

// ── Global form lock ───────────────────────────────────────────────────────

export async function getGlobalLock() {
  const result = await db.execute({
    sql: "SELECT value FROM app_settings WHERE key = 'global_form_locked'",
    args: [],
  });
  return result.rows[0]?.value === "true";
}

export async function setGlobalLock(locked) {
  await db.execute({
    sql: `INSERT INTO app_settings (key, value) VALUES ('global_form_locked', ?)
          ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    args: [String(locked)],
  });
  return locked;
}

// ── Candidate self-edit ────────────────────────────────────────────────────

const PROFILE_FIELDS = ["full_name", "date_of_birth"];
const FORM_FIELDS = [
  "attendance", "join_reason", "primary_department",
  "secondary_department", "other_societies", "recruit_reason",
];

export async function updateCandidateDetails(userId, body) {
  const result = await db.execute({
    sql: `SELECT cp.id, cs.form_locked, cs.individual_unlock
          FROM candidate_profiles cp
          LEFT JOIN candidate_status cs ON cs.candidate_id = cp.id
          WHERE cp.user_id = ?`,
    args: [userId],
  });
  const existing = result.rows[0];
  if (!existing) throw new Error("Candidate profile not found.");

  const globallyLocked = await getGlobalLock();
  if (globallyLocked && !existing.individual_unlock) {
    throw new Error("Registrations are closed. No further changes can be made.");
  }
  if (existing.form_locked) {
    throw new Error("Your form has been locked by the admin. No further changes can be made.");
  }

  const profilePayload = {};
  const formPayload = {};

  for (const field of PROFILE_FIELDS) {
    if (body[field] !== undefined && String(body[field]).trim() !== "") {
      profilePayload[field] = String(body[field]).trim();
    }
  }
  for (const field of FORM_FIELDS) {
    if (body[field] !== undefined && String(body[field]).trim() !== "") {
      formPayload[field] = String(body[field]).trim();
    }
  }

  if (!Object.keys(profilePayload).length && !Object.keys(formPayload).length) {
    throw new Error("No valid fields provided for update.");
  }

  const stmts = [];

  if (Object.keys(profilePayload).length) {
    const setClauses = Object.keys(profilePayload).map((k) => `${k} = ?`).join(", ");
    stmts.push({
      sql: `UPDATE candidate_profiles SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`,
      args: [...Object.values(profilePayload), existing.id],
    });
  }

  if (Object.keys(formPayload).length) {
    const setClauses = Object.keys(formPayload).map((k) => `${k} = ?`).join(", ");
    stmts.push({
      sql: `UPDATE candidate_form SET ${setClauses}, updated_at = datetime('now') WHERE candidate_id = ?`,
      args: [...Object.values(formPayload), existing.id],
    });
  }

  await db.batch(stmts, "write");

  const { data } = await findCandidateById(existing.id);
  return data;
}

// ── Slot Distribution ──────────────────────────────────────────────────────

export async function distributeSlots() {
  const candidates = await db.execute(
    "SELECT id FROM candidate_profiles ORDER BY created_at ASC"
  );
  if (!candidates.rows.length) return { distributed: 0 };

  const slots = await db.execute(
    "SELECT id FROM slots ORDER BY slot_day ASC, slot_number ASC, slot_venue ASC"
  );
  if (!slots.rows.length) throw new Error("No slots found in DB.");

  const TOTAL_SLOTS = slots.rows.length;

  const stmts = candidates.rows.map((c, i) => ({
    sql: `UPDATE candidate_status SET slot_id = ?, updated_at = datetime('now') WHERE candidate_id = ?`,
    args: [slots.rows[i % TOTAL_SLOTS].id, c.id],
  }));

  await db.batch(stmts, "write");
  return { distributed: candidates.rows.length };
}

export async function getSlotSummary() {
  const slots = await db.execute(
    "SELECT id, slot_day, slot_number, slot_venue FROM slots ORDER BY slot_day ASC, slot_number ASC, slot_venue ASC"
  );
  const counts = await db.execute(
    "SELECT slot_id, COUNT(*) as cnt FROM candidate_status WHERE slot_id IS NOT NULL GROUP BY slot_id"
  );

  const countMap = {};
  for (const row of counts.rows) {
    countMap[row.slot_id] = Number(row.cnt);
  }

  return slots.rows.map((s) => ({ ...s, count: countMap[s.id] || 0 }));
}

export async function clearSlots() {
  await db.execute(
    "UPDATE candidate_status SET slot_id = NULL WHERE slot_id IS NOT NULL"
  );
  return { cleared: true };
}

// ── Slot Schedules ─────────────────────────────────────────────────────────

export async function getSlotSchedules() {
  const [days, times] = await Promise.all([
    db.execute("SELECT day_number, slot_date FROM slot_day_dates ORDER BY day_number"),
    db.execute("SELECT slot_number, start_time FROM slot_time_schedules ORDER BY slot_number"),
  ]);
  return { days: days.rows, times: times.rows };
}

export async function setDayDate(dayNumber, slotDate) {
  await db.execute({
    sql: "UPDATE slot_day_dates SET slot_date = ? WHERE day_number = ?",
    args: [slotDate || null, dayNumber],
  });
  return { dayNumber, slotDate };
}

export async function setSlotTime(slotNumber, startTime) {
  await db.execute({
    sql: "UPDATE slot_time_schedules SET start_time = ? WHERE slot_number = ?",
    args: [startTime || null, slotNumber],
  });
  return { slotNumber, startTime };
}

const VENUES = ["LP106", "LP107", "LP108", "LP109"];

export async function addDayToSchedule(dayNumber) {
  await db.execute({
    sql: "INSERT INTO slot_day_dates (day_number, slot_date) VALUES (?, NULL) ON CONFLICT (day_number) DO NOTHING",
    args: [dayNumber],
  });

  const times = await db.execute("SELECT slot_number FROM slot_time_schedules");
  const slotNums = times.rows.map((t) => t.slot_number);

  if (slotNums.length > 0) {
    const stmts = [];
    for (const num of slotNums) {
      for (const venue of VENUES) {
        stmts.push({
          sql: "INSERT INTO slots (slot_day, slot_number, slot_venue) VALUES (?, ?, ?) ON CONFLICT (slot_day, slot_number, slot_venue) DO NOTHING",
          args: [dayNumber, num, venue],
        });
      }
    }
    await db.batch(stmts, "write");
  }
  return { dayNumber };
}

export async function removeDayFromSchedule(dayNumber) {
  const slotsToRemove = await db.execute({
    sql: "SELECT id FROM slots WHERE slot_day = ?",
    args: [dayNumber],
  });

  if (slotsToRemove.rows.length > 0) {
    const ids = slotsToRemove.rows.map((s) => s.id);
    const placeholders = ids.map(() => "?").join(", ");
    await db.execute({
      sql: `UPDATE candidate_status SET slot_id = NULL WHERE slot_id IN (${placeholders})`,
      args: ids,
    });
    await db.execute({ sql: "DELETE FROM slots WHERE slot_day = ?", args: [dayNumber] });
  }

  await db.execute({ sql: "DELETE FROM slot_day_dates WHERE day_number = ?", args: [dayNumber] });
  return { dayNumber };
}

export async function addSlotToSchedule(slotNumber) {
  await db.execute({
    sql: "INSERT INTO slot_time_schedules (slot_number, start_time) VALUES (?, NULL) ON CONFLICT (slot_number) DO NOTHING",
    args: [slotNumber],
  });

  const days = await db.execute("SELECT day_number FROM slot_day_dates");
  const dayNums = days.rows.map((d) => d.day_number);

  if (dayNums.length > 0) {
    const stmts = [];
    for (const day of dayNums) {
      for (const venue of VENUES) {
        stmts.push({
          sql: "INSERT INTO slots (slot_day, slot_number, slot_venue) VALUES (?, ?, ?) ON CONFLICT (slot_day, slot_number, slot_venue) DO NOTHING",
          args: [day, slotNumber, venue],
        });
      }
    }
    await db.batch(stmts, "write");
  }
  return { slotNumber };
}

export async function removeSlotFromSchedule(slotNumber) {
  const slotsToRemove = await db.execute({
    sql: "SELECT id FROM slots WHERE slot_number = ?",
    args: [slotNumber],
  });

  if (slotsToRemove.rows.length > 0) {
    const ids = slotsToRemove.rows.map((s) => s.id);
    const placeholders = ids.map(() => "?").join(", ");
    await db.execute({
      sql: `UPDATE candidate_status SET slot_id = NULL WHERE slot_id IN (${placeholders})`,
      args: ids,
    });
    await db.execute({ sql: "DELETE FROM slots WHERE slot_number = ?", args: [slotNumber] });
  }

  await db.execute({ sql: "DELETE FROM slot_time_schedules WHERE slot_number = ?", args: [slotNumber] });
  return { slotNumber };
}
