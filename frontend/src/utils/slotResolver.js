// Resolves a candidate's slot_id (UUID, FK -> public.slots.id) into the
// human-facing date / time / venue, using the slot summary (day, number,
// venue per UUID) and slot schedules (day -> date, slot number -> start time)
// that the admin has configured.
//
// This intentionally never shows the raw UUID to admins — it's an opaque
// database key with no meaning to a human reviewing candidates.

export function resolveSlot(slotId, slotSummary, slotSchedules) {
  if (!slotId) return null;

  const row = (slotSummary || []).find((s) => s.id === slotId);
  if (!row) return null;

  const days = slotSchedules?.days || [];
  const times = slotSchedules?.times || [];

  const dayRow = days.find((d) => d.day_number === row.slot_day);
  const timeRow = times.find((t) => t.slot_number === row.slot_number);

  return {
    day: row.slot_day,
    num: row.slot_number,
    venue: row.slot_venue,
    slotDate: dayRow?.slot_date ?? null, // "YYYY-MM-DD" or null
    startTime: timeRow?.start_time ?? null, // "HH:MM:SS" or null
  };
}

export function formatSlotDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatSlotTime(timeStr) {
  if (!timeStr) return null;
  const [hh, mm] = timeStr.split(":");
  const h = Number(hh);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

// One-line summary for compact UI (cards, badges).
// Falls back gracefully when the admin hasn't set a date/time yet.
export function formatSlotSummary(slotId, slotSummary, slotSchedules) {
  const resolved = resolveSlot(slotId, slotSummary, slotSchedules);
  if (!resolved) return null;

  const dateLabel = formatSlotDate(resolved.slotDate);
  const timeLabel = formatSlotTime(resolved.startTime);

  if (dateLabel && timeLabel) {
    return `${dateLabel} · ${timeLabel} · ${resolved.venue}`;
  }
  if (dateLabel) {
    return `${dateLabel} · ${resolved.venue}`;
  }
  // Date/time not configured yet — at least show the venue + day/slot number.
  return `Day ${resolved.day}, Slot ${resolved.num} · ${resolved.venue}`;
}
