import { useState } from "react";
import "./SlotDistribution.css";

const VENUES = ["LP106", "LP107", "LP108", "LP109"];

export function shortUuid(uuid) {
  if (!uuid) return "—";
  return uuid.slice(0, 8);
}

function findSlotId(summary, day, num, venue) {
  const row = summary.find(
    (s) =>
      s.slot_day === day && s.slot_number === num && s.slot_venue === venue,
  );
  return row?.id ?? null;
}

function buildGrid(summary) {
  const map = {};
  for (const row of summary) {
    const key = `${row.slot_day}-${row.slot_number}-${row.slot_venue}`;
    map[key] = { count: row.count, id: row.id };
  }
  return map;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeStr) {
  if (!timeStr) return null;
  const [hh, mm] = timeStr.split(":");
  const h = Number(hh);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

// ── Schedule Config Panel (dynamic days + slots) ───────────────────────────────

function ScheduleConfig({
  schedules,
  schedulesLoading,
  onSaveDayDate,
  onSaveSlotTime,
  onAddDay,
  onRemoveDay,
  onAddSlot,
  onRemoveSlot,
}) {
  const [dayDrafts, setDayDrafts] = useState({});
  const [timeDrafts, setTimeDrafts] = useState({});
  const [saving, setSaving] = useState({});

  const days = [...(schedules.days || [])].sort(
    (a, b) => a.day_number - b.day_number,
  );
  const slots = [...(schedules.times || [])].sort(
    (a, b) => a.slot_number - b.slot_number,
  );

  const maxDay =
    days.length > 0 ? Math.max(...days.map((d) => d.day_number)) : 0;
  const maxSlot =
    slots.length > 0 ? Math.max(...slots.map((s) => s.slot_number)) : 0;

  function getDayValue(dayNumber) {
    if (dayDrafts[dayNumber] !== undefined) return dayDrafts[dayNumber];
    const row = days.find((d) => d.day_number === dayNumber);
    return row?.slot_date ?? "";
  }

  function getTimeValue(slotNumber) {
    if (timeDrafts[slotNumber] !== undefined) return timeDrafts[slotNumber];
    const row = slots.find((t) => t.slot_number === slotNumber);
    return row?.start_time?.slice(0, 5) ?? "";
  }

  async function handleSaveDay(dayNumber) {
    const key = `day-${dayNumber}`;
    setSaving((s) => ({ ...s, [key]: true }));
    const val = getDayValue(dayNumber);
    await onSaveDayDate(dayNumber, val || null);
    setDayDrafts((d) => {
      const n = { ...d };
      delete n[dayNumber];
      return n;
    });
    setSaving((s) => ({ ...s, [key]: false }));
  }

  async function handleSaveTime(slotNumber) {
    const key = `time-${slotNumber}`;
    setSaving((s) => ({ ...s, [key]: true }));
    const val = getTimeValue(slotNumber);
    await onSaveSlotTime(slotNumber, val || null);
    setTimeDrafts((d) => {
      const n = { ...d };
      delete n[slotNumber];
      return n;
    });
    setSaving((s) => ({ ...s, [key]: false }));
  }

  return (
    <div className="sched-config">
      <div className="sched-config-header">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <div>
          <h3>Schedule Configuration</h3>
          <p>
            Set dates for each day and start times for each slot. Add or remove
            days and slots as needed.
          </p>
        </div>
      </div>

      <div className="sched-config-body">
        {/* Day dates */}
        <div className="sched-section">
          <div className="sched-section-header">
            <h4 className="sched-section-title">Day Dates</h4>
            <div className="sched-section-actions">
              <button
                className="btn btn--sm btn--ghost"
                onClick={() => onAddDay(maxDay + 1)}
                disabled={schedulesLoading}
                title="Add a new day"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Day
              </button>
            </div>
          </div>
          <div className="sched-row-list">
            {days.length === 0 && (
              <p className="sched-empty-hint">
                No days configured. Click "Add Day" to start.
              </p>
            )}
            {days.map((d) => {
              const day = d.day_number;
              const key = `day-${day}`;
              const isSaving = saving[key];
              const hasDraft = dayDrafts[day] !== undefined;
              const isDirty =
                hasDraft && dayDrafts[day] !== (d?.slot_date ?? "");

              return (
                <div key={day} className="sched-row">
                  <span className="sched-row-label">Day {day}</span>
                  {d?.slot_date && !hasDraft && (
                    <span className="sched-row-current">
                      {formatDate(d.slot_date)}
                    </span>
                  )}
                  <input
                    type="date"
                    className="sched-input"
                    value={getDayValue(day)}
                    disabled={schedulesLoading || isSaving}
                    onChange={(e) =>
                      setDayDrafts((prev) => ({
                        ...prev,
                        [day]: e.target.value,
                      }))
                    }
                  />
                  <button
                    className={`btn btn--sm ${isDirty ? "btn--primary" : "btn--ghost"}`}
                    disabled={!isDirty || isSaving || schedulesLoading}
                    onClick={() => handleSaveDay(day)}
                    title={isDirty ? "Save this date" : "No changes to save"}
                  >
                    {isSaving ? "Saving…" : "Save"}
                  </button>
                  <button
                    className="btn btn--sm btn--danger-ghost sched-remove-btn"
                    disabled={schedulesLoading}
                    onClick={() => onRemoveDay(day)}
                    title={`Remove Day ${day}`}
                    aria-label={`Remove Day ${day}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Slot times */}
        <div className="sched-section">
          <div className="sched-section-header">
            <h4 className="sched-section-title">Slot Start Times</h4>
            <div className="sched-section-actions">
              <button
                className="btn btn--sm btn--ghost"
                onClick={() => onAddSlot(maxSlot + 1)}
                disabled={schedulesLoading}
                title="Add a new slot"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Slot
              </button>
            </div>
          </div>
          <div className="sched-row-list">
            {slots.length === 0 && (
              <p className="sched-empty-hint">
                No slots configured. Click "Add Slot" to start.
              </p>
            )}
            {slots.map((t) => {
              const num = t.slot_number;
              const key = `time-${num}`;
              const isSaving = saving[key];
              const storedVal = t?.start_time?.slice(0, 5) ?? "";
              const hasDraft = timeDrafts[num] !== undefined;
              const isDirty = hasDraft && timeDrafts[num] !== storedVal;

              return (
                <div key={num} className="sched-row">
                  <span className="sched-row-label">Slot {num}</span>
                  {t?.start_time && !hasDraft && (
                    <span className="sched-row-current">
                      {formatTime(t.start_time)}
                    </span>
                  )}
                  <input
                    type="time"
                    className="sched-input"
                    value={getTimeValue(num)}
                    disabled={schedulesLoading || isSaving}
                    onChange={(e) =>
                      setTimeDrafts((prev) => ({
                        ...prev,
                        [num]: e.target.value,
                      }))
                    }
                  />
                  <button
                    className={`btn btn--sm ${isDirty ? "btn--primary" : "btn--ghost"}`}
                    disabled={!isDirty || isSaving || schedulesLoading}
                    onClick={() => handleSaveTime(num)}
                    title={isDirty ? "Save this time" : "No changes to save"}
                  >
                    {isSaving ? "Saving…" : "Save"}
                  </button>
                  <button
                    className="btn btn--sm btn--danger-ghost sched-remove-btn"
                    disabled={schedulesLoading}
                    onClick={() => onRemoveSlot(num)}
                    title={`Remove Slot ${num}`}
                    aria-label={`Remove Slot ${num}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main SlotDistribution component ───────────────────────────────────────────

export default function SlotDistribution({
  summary,
  slotLoading,
  totalCandidates,
  onDistribute,
  onClear,
  schedules,
  schedulesLoading,
  onSaveDayDate,
  onSaveSlotTime,
  onAddDay,
  onRemoveDay,
  onAddSlot,
  onRemoveSlot,
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [gridMinimised, setGridMinimised] = useState(false);

  const hasSlots = summary.some((s) => s.count > 0);
  const grid = buildGrid(summary);

  // Derive unique days and slot numbers dynamically from summary + schedules
  const allDays = [
    ...new Set([
      ...(schedules?.days || []).map((d) => d.day_number),
      ...summary.map((s) => s.slot_day),
    ]),
  ].sort((a, b) => a - b);

  const allSlotNums = [
    ...new Set([
      ...(schedules?.times || []).map((t) => t.slot_number),
      ...summary.map((s) => s.slot_number),
    ]),
  ].sort((a, b) => a - b);

  const totalSlots = allDays.length * allSlotNums.length * VENUES.length;

  async function handleDistribute() {
    setDistributing(true);
    await onDistribute();
    setDistributing(false);
    setGridMinimised(false); // always expand after a fresh distribution
  }

  async function handleClear() {
    setConfirmClear(false);
    await onClear();
  }

  return (
    <div className="slot-panel">
      {/* ── Header ── */}
      <div className="slot-panel-header">
        <div className="slot-panel-title">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <div>
            <h2>Slot Distribution</h2>
            <p className="slot-panel-sub">
              {allDays.length} day{allDays.length !== 1 ? "s" : ""} ·{" "}
              {allSlotNums.length} slot{allSlotNums.length !== 1 ? "s" : ""}/day
              · {VENUES.length} venues ({VENUES.join(", ")}) · {totalSlots}{" "}
              total slots
            </p>
          </div>
        </div>

        <div className="slot-panel-actions">
          <button
            className={`btn btn--sm ${showSchedule ? "btn--secondary" : "btn--ghost"}`}
            onClick={() => setShowSchedule((v) => !v)}
            title="Configure dates and times for each day/slot"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {showSchedule ? "Hide Schedule" : "Set Schedule"}
          </button>

          {hasSlots && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setGridMinimised((v) => !v)}
              title={gridMinimised ? "Expand slot grid" : "Minimise slot grid"}
              aria-expanded={!gridMinimised}
              aria-controls="slot-grid-region"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transition: "transform 0.2s",
                  transform: gridMinimised ? "rotate(-90deg)" : "rotate(0deg)",
                }}
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
              {gridMinimised ? "Expand" : "Minimise"}
            </button>
          )}
          {hasSlots && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setConfirmClear(true)}
              disabled={slotLoading}
              title="Reset all slot assignments"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
              Clear Slots
            </button>
          )}
          <button
            className="btn btn--primary btn--sm"
            onClick={handleDistribute}
            disabled={slotLoading || distributing || totalCandidates === 0}
            title={
              totalCandidates === 0
                ? "No candidates to distribute"
                : hasSlots
                  ? "Re-distribute slots (will reassign all)"
                  : "Distribute slots equally among all candidates"
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="14" y2="12" />
              <line x1="4" y1="18" x2="10" y2="18" />
              <polyline points="15 15 20 12 15 9" />
            </svg>
            {distributing || slotLoading
              ? "Distributing…"
              : hasSlots
                ? "Re-distribute"
                : "Distribute Slots"}
          </button>
        </div>
      </div>

      {/* ── Schedule config (collapsible) ── */}
      {showSchedule && (
        <ScheduleConfig
          schedules={schedules}
          schedulesLoading={schedulesLoading}
          onSaveDayDate={onSaveDayDate}
          onSaveSlotTime={onSaveSlotTime}
          onAddDay={onAddDay}
          onRemoveDay={onRemoveDay}
          onAddSlot={onAddSlot}
          onRemoveSlot={onRemoveSlot}
        />
      )}

      {/* ── Empty notice ── */}
      {!hasSlots && (
        <div className="slot-empty-notice">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>
            Slots have not been distributed yet. Click{" "}
            <strong>Distribute Slots</strong> to assign all {totalCandidates}{" "}
            candidate{totalCandidates !== 1 ? "s" : ""} equally across{" "}
            {totalSlots} slots.
          </span>
        </div>
      )}

      {/* ── Grid ── */}
      {hasSlots && allDays.length > 0 && (
        <div
          id="slot-grid-region"
          className={`slot-grid-wrap${gridMinimised ? " slot-grid-wrap--minimised" : ""}`}
        >
          {gridMinimised ? (
            <div className="slot-grid-minimised-bar">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="slot-grid-minimised-text">
                Distribution across{" "}
                <strong>
                  {allDays.length} day{allDays.length !== 1 ? "s" : ""}
                </strong>
                ,{" "}
                <strong>
                  {allSlotNums.length} slot{allSlotNums.length !== 1 ? "s" : ""}
                </strong>
                , <strong>{VENUES.length} venues</strong> — {totalCandidates}{" "}
                candidate{totalCandidates !== 1 ? "s" : ""} assigned
              </span>
              <button
                className="btn btn--ghost btn--sm slot-grid-expand-btn"
                onClick={() => setGridMinimised(false)}
                title="Expand slot grid"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                Expand
              </button>
            </div>
          ) : (
            allDays.map((day) => {
              const dayRow = schedules?.days?.find((d) => d.day_number === day);
              const dayDateLabel = dayRow?.slot_date
                ? formatDate(dayRow.slot_date)
                : null;

              return (
                <div key={day} className="slot-day-block">
                  <h3 className="slot-day-label">
                    Day {day}
                    {dayDateLabel && (
                      <span className="slot-day-date">{dayDateLabel}</span>
                    )}
                  </h3>
                  <div
                    className="slot-day-grid"
                    style={{
                      gridTemplateColumns: `100px repeat(${VENUES.length}, 1fr)`,
                    }}
                  >
                    {/* header */}
                    <div className="slot-venue-header slot-corner" />
                    {VENUES.map((v) => (
                      <div key={v} className="slot-venue-header">
                        {v}
                      </div>
                    ))}

                    {/* rows */}
                    {allSlotNums.map((num) => {
                      const rowTotal = VENUES.reduce(
                        (sum, v) =>
                          sum + (grid[`${day}-${num}-${v}`]?.count ?? 0),
                        0,
                      );
                      const timeRow = schedules?.times?.find(
                        (t) => t.slot_number === num,
                      );
                      const timeLabel = timeRow?.start_time
                        ? formatTime(timeRow.start_time)
                        : null;

                      return [
                        <div
                          key={`lbl-${day}-${num}`}
                          className="slot-row-label"
                        >
                          <span>Slot {num}</span>
                          {timeLabel && (
                            <span className="slot-row-time">{timeLabel}</span>
                          )}
                          <span className="slot-row-total">{rowTotal}</span>
                        </div>,
                        ...VENUES.map((venue) => {
                          const cell = grid[`${day}-${num}-${venue}`];
                          const count = cell?.count ?? 0;
                          const slotUuid = findSlotId(summary, day, num, venue);
                          return (
                            <div
                              key={`${day}-${num}-${venue}`}
                              className={`slot-cell ${count === 0 ? "slot-cell--empty" : ""}`}
                              title={slotUuid ? `Slot UUID: ${slotUuid}` : ""}
                            >
                              <span className="slot-cell-id">
                                {slotUuid ? shortUuid(slotUuid) + "…" : "—"}
                              </span>
                              <span className="slot-cell-count">{count}</span>
                              <span className="slot-cell-label">
                                candidates
                              </span>
                            </div>
                          );
                        }),
                      ];
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Confirm clear ── */}
      {confirmClear && (
        <div className="slot-backdrop" onClick={() => setConfirmClear(false)}>
          <div
            className="slot-confirm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Clear All Slots?</h3>
            <p>
              This will remove slot assignments from all {totalCandidates}{" "}
              candidate{totalCandidates !== 1 ? "s" : ""}. You can re-distribute
              at any time.
            </p>
            <div className="slot-confirm-actions">
              <button
                className="btn btn--ghost"
                onClick={() => setConfirmClear(false)}
              >
                Cancel
              </button>
              <button className="btn btn--danger" onClick={handleClear}>
                Yes, Clear Slots
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
