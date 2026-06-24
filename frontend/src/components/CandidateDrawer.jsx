import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import {
  resolveSlot,
  formatSlotDate,
  formatSlotTime,
} from "../utils/slotResolver";

export default function CandidateDrawer({
  candidate,
  globalLocked,
  slotSummary,
  slotSchedules,
  onClose,
  onUpdateStatus,
  onUpdateAttendance,
  onDelete,
  onToggleLock,
  onIndividualUnlock,
}) {
  const [dialog, setDialog] = useState(null);
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (!candidate) return;

    scrollYRef.current = window.scrollY;
    document.body.classList.add("drawer-open");
    document.body.style.top = `-${scrollYRef.current}px`;

    return () => {
      document.body.classList.remove("drawer-open");
      document.body.style.top = "";
      window.scrollTo({ top: scrollYRef.current, behavior: "instant" });
    };
  }, [candidate]);

  if (!candidate) return null;

  const isPresent = candidate.quiz_attended === true;
  const isLocked = candidate.form_locked === true;
  const isIndividuallyUnlocked = candidate.individual_unlock === true;
  const resolvedSlot = resolveSlot(
    candidate.slot_id,
    slotSummary,
    slotSchedules,
  );

  function confirmAction(config, action) {
    setDialog({ ...config, _action: action });
  }

  function handleConfirm() {
    const action = dialog._action;
    setDialog(null);
    action();
  }

  // ── Form Access section renderer ──────────────────────────────────────────
  // Three scenarios:
  //   A) Global lock OFF → standard individual lock/unlock
  //   B) Global lock ON, candidate individually unlocked → can re-lock override
  //   C) Global lock ON, candidate NOT individually unlocked → offer to unlock individually

  function renderFormAccessSection() {
    if (!globalLocked) {
      // Scenario A: Normal individual lock controls
      return (
        <div className="actions" style={{ flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: "0.82rem", color: "#5a7896", marginBottom: 4 }}>
            {isLocked
              ? "The candidate's form is currently locked. They cannot make any edits."
              : "The candidate can currently edit their form. Lock it to prevent further changes."}
          </p>
          <button
            className={isLocked ? "attend-present" : "reject"}
            style={{ flex: "none", width: "100%" }}
            onClick={() =>
              confirmAction(
                isLocked
                  ? {
                      variant: "warning",
                      title: "Unlock Candidate Form?",
                      message: `${candidate.full_name} will be able to edit their application details again.`,
                      confirmLabel: "Unlock Form",
                    }
                  : {
                      variant: "danger",
                      title: "Lock Candidate Form?",
                      message: `${candidate.full_name} will no longer be able to edit their application. You can unlock it later.`,
                      confirmLabel: "Lock Form",
                    },
                () => onToggleLock(candidate.id, !isLocked),
              )
            }
          >
            {isLocked ? (
              <>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: 6, verticalAlign: "middle" }}
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                </svg>
                Unlock Form
              </>
            ) : (
              <>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: 6, verticalAlign: "middle" }}
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Lock Form
              </>
            )}
          </button>
        </div>
      );
    }

    // Scenario B & C: Global lock is active
    if (isIndividuallyUnlocked) {
      // Scenario B: Already granted individual override — show revoke option
      return (
        <div className="actions" style={{ flexDirection: "column", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
              marginBottom: 4,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#16a34a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginTop: 1, flexShrink: 0 }}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
            <p style={{ fontSize: "0.82rem", color: "#15803d", margin: 0, lineHeight: 1.45 }}>
              This candidate has been individually unlocked and can edit their
              form despite the global lock being active.
            </p>
          </div>
          <button
            className="reject"
            style={{ flex: "none", width: "100%" }}
            onClick={() =>
              confirmAction(
                {
                  variant: "danger",
                  title: "Revoke Individual Unlock?",
                  message: `${candidate.full_name} will lose their individual override and be blocked by the global lock again.`,
                  confirmLabel: "Revoke Unlock",
                },
                () => onIndividualUnlock(candidate.id, false),
              )
            }
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: 6, verticalAlign: "middle" }}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Revoke Individual Unlock
          </button>
        </div>
      );
    }

    // Scenario C: Global lock active, no override yet — offer to grant it
    return (
      <div className="actions" style={{ flexDirection: "column", gap: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.2)",
            marginBottom: 4,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#b91c1c"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginTop: 1, flexShrink: 0 }}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p style={{ fontSize: "0.82rem", color: "#b91c1c", margin: 0, lineHeight: 1.45 }}>
            Global lock is active — this candidate cannot edit their form. You
            can grant them an individual exception to override the global lock.
          </p>
        </div>
        <button
          className="attend-present"
          style={{ flex: "none", width: "100%" }}
          onClick={() =>
            confirmAction(
              {
                variant: "warning",
                title: "Unlock Form for This Candidate?",
                message: `${candidate.full_name} will be able to edit their application even though the global lock is active. You can revoke this at any time.`,
                confirmLabel: "Unlock Individually",
              },
              () => onIndividualUnlock(candidate.id, true),
            )
          }
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginRight: 6, verticalAlign: "middle" }}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
          </svg>
          Unlock Form for This Candidate
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />

      <div className="drawer open">
        <div className="drawer-body">
          <div className="drawer-profile">
            <div className="big-avatar">
              {candidate.full_name
                ?.split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)}
            </div>
            <h1>{candidate.full_name}</h1>
            <p>{candidate.email}</p>

            {/* Form lock / individual unlock badge */}
            {isIndividuallyUnlocked && globalLocked ? (
              <span
                style={{
                  marginTop: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 11px",
                  borderRadius: 999,
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.3)",
                  color: "#15803d",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                </svg>
                Individually Unlocked
              </span>
            ) : isLocked ? (
              <span
                style={{
                  marginTop: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 11px",
                  borderRadius: 999,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "#b91c1c",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Form Locked
              </span>
            ) : null}
          </div>

          <div className="details-grid-modal">
            <div className="detail-item">
              <h4>Application Number</h4>
              <p>{candidate.application_number}</p>
            </div>

            <div className="detail-item">
              <h4>Date Of Birth</h4>
              <p>{candidate.date_of_birth}</p>
            </div>

            <div className="detail-item">
              <h4>Attendance</h4>
              <p>{candidate.attendance}</p>
            </div>

            <div className="detail-item">
              <h4>Current Status</h4>
              <p
                className={`status ${candidate.application_status?.toLowerCase()}`}
              >
                {candidate.application_status}
              </p>
            </div>

            {/* ── Assigned Slot ── */}
            {resolvedSlot ? (
              <div className="detail-item detail-item--slot">
                <h4>Assigned Slot</h4>
                <p className="slot-pill">
                  {(() => {
                    const dateLabel = formatSlotDate(resolvedSlot.slotDate);
                    const timeLabel = formatSlotTime(resolvedSlot.startTime);
                    if (dateLabel) {
                      return (
                        <>
                          <span className="slot-pill-id">{dateLabel}</span>
                          {[timeLabel, resolvedSlot.venue]
                            .filter(Boolean)
                            .join(" · ")}
                        </>
                      );
                    }
                    // Admin hasn't set a calendar date/time yet — fall back
                    // to the day/slot-number scheme so it's never blank.
                    return `Day ${resolvedSlot.day} · Slot ${resolvedSlot.num} · ${resolvedSlot.venue}`;
                  })()}
                </p>
              </div>
            ) : (
              <div className="detail-item detail-item--slot">
                <h4>Assigned Slot</h4>
                <p className="slot-pill slot-pill--none">Not assigned yet</p>
              </div>
            )}

            <div className="detail-item">
              <h4>Primary Department</h4>
              <p>{candidate.primary_department}</p>
            </div>

            <div className="detail-item">
              <h4>Secondary Department</h4>
              <p>{candidate.secondary_department}</p>
            </div>

            <div className="detail-item detail-item--wide">
              <h4>Why MLSC?</h4>
              <p>{candidate.join_reason}</p>
            </div>

            <div className="detail-item detail-item--wide">
              <h4>Other Societies</h4>
              <p>{candidate.other_societies}</p>
            </div>

            <div className="detail-item detail-item--wide">
              <h4>Why Should We Recruit You?</h4>
              <p>{candidate.recruit_reason}</p>
            </div>
          </div>

          {/* ── Application Status ── */}
          <div className="drawer-section-label">Application Status</div>
          <div className="actions">
            <button
              className="accept"
              onClick={() =>
                confirmAction(
                  {
                    variant: "warning",
                    title: "Shortlist Candidate?",
                    message: `This will mark ${candidate.full_name} as Shortlisted. You can change this later.`,
                    confirmLabel: "Shortlist",
                  },
                  () => onUpdateStatus(candidate.id, "Shortlisted"),
                )
              }
            >
              Shortlist
            </button>

            <button
              className="reject"
              onClick={() =>
                confirmAction(
                  {
                    variant: "danger",
                    title: "Reject Candidate?",
                    message: `This will mark ${candidate.full_name} as Rejected. You can change this later.`,
                    confirmLabel: "Reject",
                  },
                  () => onUpdateStatus(candidate.id, "Rejected"),
                )
              }
            >
              Reject
            </button>
          </div>

          {/* ── Quiz Attendance ── */}
          <div className="drawer-section-label">Quiz Attendance</div>
          <div className="actions">
            <button
              className={isPresent ? "attend-neutral" : "attend-present"}
              disabled={isPresent}
              onClick={() =>
                confirmAction(
                  {
                    variant: "warning",
                    title: "Mark as Present?",
                    message: `Manually mark ${candidate.full_name} as present for the quiz. This overrides QR scanning.`,
                    confirmLabel: "Mark Present",
                  },
                  () => onUpdateAttendance(candidate.id, true),
                )
              }
            >
              {isPresent ? "✓ Already Present" : "Mark Present"}
            </button>

            <button
              className={!isPresent ? "attend-neutral" : "attend-absent"}
              disabled={!isPresent}
              onClick={() =>
                confirmAction(
                  {
                    variant: "danger",
                    title: "Mark as Absent?",
                    message: `This will revert ${candidate.full_name}'s attendance to absent. Only do this if it was marked incorrectly.`,
                    confirmLabel: "Mark Absent",
                  },
                  () => onUpdateAttendance(candidate.id, false),
                )
              }
            >
              {!isPresent ? "✗ Already Absent" : "Mark Absent"}
            </button>
          </div>

          {/* ── Form Lock ── */}
          <div className="drawer-section-label">Form Access</div>
          {renderFormAccessSection()}

          {/* ── Danger Zone ── */}
          <div className="drawer-section-label drawer-section-label--danger">
            Danger Zone
          </div>
          <div className="actions">
            <button
              className="delete-btn"
              onClick={() =>
                confirmAction(
                  {
                    variant: "danger",
                    title: "Delete Candidate?",
                    message: `This will permanently delete ${candidate.full_name}'s entire application and cannot be undone.`,
                    confirmLabel: "Delete Permanently",
                  },
                  () => onDelete(candidate.id),
                )
              }
            >
              Delete Candidate
            </button>
          </div>
        </div>

        <div className="drawer-footer">
          <button className="drawer-close-btn" onClick={onClose}>
            ✕ Close
          </button>
        </div>
      </div>

      <ConfirmDialog
        dialog={dialog}
        onConfirm={handleConfirm}
        onCancel={() => setDialog(null)}
      />
    </>
  );
}
