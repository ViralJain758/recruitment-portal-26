import { supabaseAdmin } from "../config/supabase.js";

export async function fetchAllCandidates() {
  const { data, error } = await supabaseAdmin
    .from("candidate_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function updateStatus(id, status) {
  const { data, error } = await supabaseAdmin
    .from("candidate_profiles")
    .update({ application_status: status })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAttendance(id, present) {
  const updatePayload = {
    quiz_attended: present,
    quiz_attended_at: present ? new Date().toISOString() : null,
  };

  const { data, error } = await supabaseAdmin
    .from("candidate_profiles")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCandidate(id) {
  const { error } = await supabaseAdmin
    .from("candidate_profiles")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// QR codes are only valid for scanning starting this many minutes before the
// candidate's allotted slot. This mirrors the candidate dashboard's display
// gating, but enforced here so it can't be bypassed by calling the
// attendance endpoint directly.
const QR_UNLOCK_MINUTES_BEFORE = 30;

async function resolveCandidateSlotDateTime(candidate) {
  if (!candidate.slot_id) return null;

  const { data: slot, error: slotError } = await supabaseAdmin
    .from("slots")
    .select("slot_day, slot_number")
    .eq("id", candidate.slot_id)
    .maybeSingle();

  if (slotError || !slot) return null;

  const [{ data: dayRow }, { data: timeRow }] = await Promise.all([
    supabaseAdmin
      .from("slot_day_dates")
      .select("slot_date")
      .eq("day_number", slot.slot_day)
      .maybeSingle(),
    supabaseAdmin
      .from("slot_time_schedules")
      .select("start_time")
      .eq("slot_number", slot.slot_number)
      .maybeSingle(),
  ]);

  if (!dayRow?.slot_date || !timeRow?.start_time) return null;

  const dt = new Date(`${dayRow.slot_date}T${timeRow.start_time}`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export async function markQuizAttendance(qrToken) {
  const { data: candidate, error: candidateError } = await supabaseAdmin
    .from("candidate_profiles")
    .select("*")
    .eq("qr_token", qrToken)
    .single();

  if (candidateError || !candidate) {
    throw new Error("Candidate not found");
  }

  if (candidate.quiz_attended) {
    return { alreadyPresent: true, candidate };
  }

  // Enforce the QR validity window: only scannable from 30 minutes before
  // the candidate's allotted slot onward. If the admin hasn't configured a
  // date/time for the slot yet, there's nothing to gate against, so allow it
  // (matches the dashboard's "unscheduled" display state).
  const slotDateTime = await resolveCandidateSlotDateTime(candidate);
  if (slotDateTime) {
    const unlockAt = new Date(
      slotDateTime.getTime() - QR_UNLOCK_MINUTES_BEFORE * 60_000,
    );
    if (new Date() < unlockAt) {
      throw new Error(
        `This QR code is not valid yet. It unlocks ${QR_UNLOCK_MINUTES_BEFORE} minutes before the candidate's slot.`,
      );
    }
  }

  const { data: updatedCandidate, error: updateError } = await supabaseAdmin
    .from("candidate_profiles")
    .update({
      quiz_attended: true,
      quiz_attended_at: new Date().toISOString(),
    })
    .eq("id", candidate.id)
    .select()
    .single();

  if (updateError) throw updateError;

  return { alreadyPresent: false, candidate: updatedCandidate };
}

export async function getAttendanceStatsService() {
  const { count: totalCandidates, error: totalError } = await supabaseAdmin
    .from("candidate_profiles")
    .select("*", { count: "exact", head: true });

  if (totalError) throw totalError;

  const { count: presentCandidates, error: presentError } = await supabaseAdmin
    .from("candidate_profiles")
    .select("*", { count: "exact", head: true })
    .eq("quiz_attended", true);

  if (presentError) throw presentError;

  return { totalCandidates, presentCandidates };
}

// ── Form lock ──────────────────────────────────────────────────────────────

export async function toggleFormLock(id, locked) {
  const { data, error } = await supabaseAdmin
    .from("candidate_profiles")
    .update({ form_locked: locked, individual_unlock: false })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Individual unlock override (used when global lock is active) ───────────

export async function setIndividualUnlock(id, unlocked) {
  const updatePayload = unlocked
    ? { individual_unlock: true, form_locked: false }
    : { individual_unlock: false };

  const { data, error } = await supabaseAdmin
    .from("candidate_profiles")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Global form lock ───────────────────────────────────────────────────────

export async function getGlobalLock() {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "global_form_locked")
    .maybeSingle();

  if (error) throw error;
  return data?.value === "true";
}

export async function setGlobalLock(locked) {
  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert(
      { key: "global_form_locked", value: String(locked) },
      { onConflict: "key" },
    );

  if (error) throw error;
  return locked;
}

// ── Candidate self-edit ────────────────────────────────────────────────────

const EDITABLE_FIELDS = [
  "full_name",
  "date_of_birth",
  "attendance",
  "join_reason",
  "primary_department",
  "secondary_department",
  "other_societies",
  "recruit_reason",
];

export async function updateCandidateDetails(userId, body) {
  let existing = null;

  const { data: profileData, error: fetchError } = await supabaseAdmin
    .from("candidate_profiles")
    .select("id, form_locked, individual_unlock")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    const msg = (fetchError.message || "").toLowerCase();
    const isColumnMissing =
      msg.includes("individual_unlock") || fetchError.code === "42703";

    if (!isColumnMissing) throw new Error("Failed to fetch candidate profile.");

    const { data: fallback, error: fallbackError } = await supabaseAdmin
      .from("candidate_profiles")
      .select("id, form_locked")
      .eq("user_id", userId)
      .maybeSingle();

    if (fallbackError) throw new Error("Failed to fetch candidate profile.");
    existing = fallback ? { ...fallback, individual_unlock: false } : null;
  } else {
    existing = profileData;
  }

  if (!existing) throw new Error("Candidate profile not found.");

  const globallyLocked = await getGlobalLock();
  if (globallyLocked && !existing.individual_unlock)
    throw new Error(
      "Registrations are closed. No further changes can be made.",
    );

  if (existing.form_locked)
    throw new Error(
      "Your form has been locked by the admin. No further changes can be made.",
    );

  const payload = {};
  for (const field of EDITABLE_FIELDS) {
    if (
      body[field] !== undefined &&
      body[field] !== null &&
      String(body[field]).trim() !== ""
    ) {
      payload[field] = String(body[field]).trim();
    }
  }

  if (!Object.keys(payload).length) {
    throw new Error("No valid fields provided for update.");
  }

  const { data, error } = await supabaseAdmin
    .from("candidate_profiles")
    .update(payload)
    .eq("id", existing.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Slot Distribution ──────────────────────────────────────────────────────────
// slots.id is a UUID — fetched from the DB, never computed client-side.

export async function distributeSlots() {
  // 1. Fetch all candidates ordered by created_at (deterministic)
  const { data: candidates, error: fetchErr } = await supabaseAdmin
    .from("candidate_profiles")
    .select("id")
    .order("created_at", { ascending: true });

  if (fetchErr) throw fetchErr;
  if (!candidates || candidates.length === 0) {
    return { distributed: 0 };
  }

  // 2. Fetch all 48 slot UUIDs in their canonical order
  const { data: slots, error: slotErr } = await supabaseAdmin
    .from("slots")
    .select("id")
    .order("slot_day", { ascending: true })
    .order("slot_number", { ascending: true })
    .order("slot_venue", { ascending: true });

  if (slotErr) throw slotErr;
  if (!slots || slots.length === 0) throw new Error("No slots found in DB.");

  const TOTAL_SLOTS = slots.length;

  // 3. Round-robin across the UUID slot ids
  for (let i = 0; i < candidates.length; i++) {
    const slotId = slots[i % TOTAL_SLOTS].id; // UUID string
    const { error: updateErr } = await supabaseAdmin
      .from("candidate_profiles")
      .update({ slot_id: slotId })
      .eq("id", candidates[i].id);
    if (updateErr) throw updateErr;
  }

  return { distributed: candidates.length };
}

export async function getSlotSummary() {
  // Fetch all 48 slots with a count of assigned candidates
  const { data: slots, error: slotErr } = await supabaseAdmin
    .from("slots")
    .select("id, slot_day, slot_number, slot_venue")
    .order("slot_day", { ascending: true })
    .order("slot_number", { ascending: true })
    .order("slot_venue", { ascending: true });

  if (slotErr) throw slotErr;

  // Count candidates per slot_id
  const { data: counts, error: countErr } = await supabaseAdmin
    .from("candidate_profiles")
    .select("slot_id")
    .not("slot_id", "is", null);

  if (countErr) throw countErr;

  const countMap = {};
  for (const row of counts || []) {
    countMap[row.slot_id] = (countMap[row.slot_id] || 0) + 1;
  }

  return (slots || []).map((s) => ({ ...s, count: countMap[s.id] || 0 }));
}

export async function clearSlots() {
  const { error } = await supabaseAdmin
    .from("candidate_profiles")
    .update({ slot_id: null })
    .gt("id", 0);
  if (error) throw error;
  return { cleared: true };
}

// ── Slot Schedules ─────────────────────────────────────────────────────────────
// Day dates and per-slot-number start times, stored in two small tables.

export async function getSlotSchedules() {
  const [{ data: days, error: dayErr }, { data: times, error: timeErr }] =
    await Promise.all([
      supabaseAdmin
        .from("slot_day_dates")
        .select("day_number, slot_date")
        .order("day_number"),
      supabaseAdmin
        .from("slot_time_schedules")
        .select("slot_number, start_time")
        .order("slot_number"),
    ]);

  if (dayErr) throw dayErr;
  if (timeErr) throw timeErr;

  return { days: days || [], times: times || [] };
}

export async function setDayDate(dayNumber, slotDate) {
  // slotDate: "YYYY-MM-DD" string or null to clear
  const { error } = await supabaseAdmin
    .from("slot_day_dates")
    .update({ slot_date: slotDate || null })
    .eq("day_number", dayNumber);

  if (error) throw error;
  return { dayNumber, slotDate };
}

export async function setSlotTime(slotNumber, startTime) {
  // startTime: "HH:MM" string or null to clear
  const { error } = await supabaseAdmin
    .from("slot_time_schedules")
    .update({ start_time: startTime || null })
    .eq("slot_number", slotNumber);

  if (error) throw error;
  return { slotNumber, startTime };
}

export async function addDayToSchedule(dayNumber) {
  const { error: dayErr } = await supabaseAdmin
    .from("slot_day_dates")
    .upsert(
      { day_number: dayNumber, slot_date: null },
      { onConflict: "day_number" },
    );
  if (dayErr) throw dayErr;

  const { data: times, error: timesErr } = await supabaseAdmin
    .from("slot_time_schedules")
    .select("slot_number");
  if (timesErr) throw timesErr;

  const VENUES = ["LP106", "LP107", "LP108", "LP109"];
  const slotNums = (times || []).map((t) => t.slot_number);

  if (slotNums.length > 0) {
    const newSlots = [];
    for (const num of slotNums) {
      for (const venue of VENUES) {
        newSlots.push({
          slot_day: dayNumber,
          slot_number: num,
          slot_venue: venue,
        });
      }
    }
    const { error: slotErr } = await supabaseAdmin
      .from("slots")
      .upsert(newSlots, { onConflict: "slot_day,slot_number,slot_venue" });
    if (slotErr) throw slotErr;
  }

  return { dayNumber };
}

export async function removeDayFromSchedule(dayNumber) {
  const { data: slotsToRemove, error: fetchErr } = await supabaseAdmin
    .from("slots")
    .select("id")
    .eq("slot_day", dayNumber);
  if (fetchErr) throw fetchErr;

  if (slotsToRemove && slotsToRemove.length > 0) {
    const ids = slotsToRemove.map((s) => s.id);
    const { error: clearErr } = await supabaseAdmin
      .from("candidate_profiles")
      .update({ slot_id: null })
      .in("slot_id", ids);
    if (clearErr) throw clearErr;

    const { error: slotDelErr } = await supabaseAdmin
      .from("slots")
      .delete()
      .eq("slot_day", dayNumber);
    if (slotDelErr) throw slotDelErr;
  }

  const { error: dayDelErr } = await supabaseAdmin
    .from("slot_day_dates")
    .delete()
    .eq("day_number", dayNumber);
  if (dayDelErr) throw dayDelErr;

  return { dayNumber };
}

export async function addSlotToSchedule(slotNumber) {
  const { error: timeErr } = await supabaseAdmin
    .from("slot_time_schedules")
    .upsert(
      { slot_number: slotNumber, start_time: null },
      { onConflict: "slot_number" },
    );
  if (timeErr) throw timeErr;

  const { data: days, error: daysErr } = await supabaseAdmin
    .from("slot_day_dates")
    .select("day_number");
  if (daysErr) throw daysErr;

  const VENUES = ["LP106", "LP107", "LP108", "LP109"];
  const dayNums = (days || []).map((d) => d.day_number);

  if (dayNums.length > 0) {
    const newSlots = [];
    for (const day of dayNums) {
      for (const venue of VENUES) {
        newSlots.push({
          slot_day: day,
          slot_number: slotNumber,
          slot_venue: venue,
        });
      }
    }
    const { error: slotErr } = await supabaseAdmin
      .from("slots")
      .upsert(newSlots, { onConflict: "slot_day,slot_number,slot_venue" });
    if (slotErr) throw slotErr;
  }

  return { slotNumber };
}

export async function removeSlotFromSchedule(slotNumber) {
  const { data: slotsToRemove, error: fetchErr } = await supabaseAdmin
    .from("slots")
    .select("id")
    .eq("slot_number", slotNumber);
  if (fetchErr) throw fetchErr;

  if (slotsToRemove && slotsToRemove.length > 0) {
    const ids = slotsToRemove.map((s) => s.id);
    const { error: clearErr } = await supabaseAdmin
      .from("candidate_profiles")
      .update({ slot_id: null })
      .in("slot_id", ids);
    if (clearErr) throw clearErr;

    const { error: slotDelErr } = await supabaseAdmin
      .from("slots")
      .delete()
      .eq("slot_number", slotNumber);
    if (slotDelErr) throw slotDelErr;
  }

  const { error: timeDelErr } = await supabaseAdmin
    .from("slot_time_schedules")
    .delete()
    .eq("slot_number", slotNumber);
  if (timeDelErr) throw timeDelErr;

  return { slotNumber };
}
