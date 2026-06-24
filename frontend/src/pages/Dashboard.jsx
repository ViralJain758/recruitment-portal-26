import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { updateCandidateDetails, getSlotSchedules } from "../lib/api";
import mlscLogo from "../assets/MLSC-logo.png";
import "./CandidateDashboard.css";

const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
).replace(/\/$/, "");

function useSlotInfo(slotId) {
  const [slotInfo, setSlotInfo] = useState(undefined); // undefined = loading

  useEffect(() => {
    if (!slotId) {
      setSlotInfo(null);
      return;
    }

    let cancelled = false;

    async function resolve() {
      try {
        // Fetch the matching slot row directly from Supabase REST via the backend
        // The public.slots table has RLS "select = true" so we can hit it via
        // the /api/admin/slots/summary endpoint which already returns all rows.
        const [summaryRes, schedulesRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/admin/slots/summary`),
          fetch(`${apiBaseUrl}/api/admin/slots/schedules`),
        ]);

        if (!summaryRes.ok) throw new Error("Failed to load slots");
        const summary = await summaryRes.json();
        const schedules = schedulesRes.ok
          ? await schedulesRes.json()
          : { days: [], times: [] };

        if (cancelled) return;

        const row = summary.find((s) => s.id === slotId);
        if (!row) {
          setSlotInfo(null);
          return;
        }

        // Find configured date for this day
        const dayRow = (schedules.days || []).find(
          (d) => d.day_number === row.slot_day,
        );
        const timeRow = (schedules.times || []).find(
          (t) => t.slot_number === row.slot_number,
        );

        setSlotInfo({
          day: row.slot_day,
          num: row.slot_number,
          venue: row.slot_venue,
          slotDate: dayRow?.slot_date ?? null, // "YYYY-MM-DD" or null
          startTime: timeRow?.start_time ?? null, // "HH:MM:SS" or null
        });
      } catch (err) {
        console.error("Failed to resolve slot info:", err);
        if (!cancelled) setSlotInfo(null);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [slotId]);

  return slotInfo; // undefined = still loading, null = no slot / not found
}

function formatSlotDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatSlotTime(timeStr) {
  if (!timeStr) return null;
  const [hh, mm] = timeStr.split(":");
  const h = Number(hh);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

// ─── QR validity window ────────────────────────────────────────────────────────
// The candidate's QR code becomes valid starting 30 minutes before their
// allotted slot's scheduled date/time, and stays valid from that point on
// (it never needs to "expire" on the client — attendance is single-use on
// the server once scanned).

const QR_UNLOCK_MINUTES_BEFORE = 30;

// Builds a real Date from the admin-configured slot date + start time.
// Returns null if either piece hasn't been configured yet.
function getSlotDateTime(slotInfo) {
  if (!slotInfo?.slotDate || !slotInfo?.startTime) return null;
  const dt = new Date(`${slotInfo.slotDate}T${slotInfo.startTime}`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// Recomputes on an interval so the UI flips from "locked" to "active"
// automatically as the unlock time arrives, without needing a refresh.
function useQrUnlockState(slotInfo) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const slotDateTime = getSlotDateTime(slotInfo);
  if (!slotDateTime) {
    // No configured date/time yet — nothing to gate against.
    return { status: "unscheduled", unlockAt: null, slotDateTime: null };
  }

  const unlockAt = new Date(
    slotDateTime.getTime() - QR_UNLOCK_MINUTES_BEFORE * 60_000,
  );

  return {
    status: now >= unlockAt ? "active" : "locked",
    unlockAt,
    slotDateTime,
  };
}

function formatClockTime(date) {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatUnlockMoment(date) {
  const time = formatClockTime(date);
  if (isSameDay(date, new Date())) return time;
  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${day}, ${time}`;
}

const SUPPORT = { email: "mlsc@thapar.edu", phone: "+91 9720257315" };

const FAQS = [
  {
    q: "When will the recruitment test be conducted?",
    a: "The test will be held on the date and time shown in the Test Schedule card above.",
  },
  {
    q: "Can I change my department preference?",
    a: "You can edit your details using the Edit Details button before the deadline.",
  },
  {
    q: "What should I bring for the test?",
    a: "Bring your college ID card and any materials mentioned in the recruitment guidelines.",
  },
  {
    q: "How will I know my selection status?",
    a: "Status updates will be shared via email and reflected in this portal.",
  },
  {
    q: "Can I edit my application after submission?",
    a: "You may update your details via Edit Details until the deadline.",
  },
  {
    q: "Whom should I contact for technical issues?",
    a: "Reach out to the support team using the contact details in the Contact Support section below.",
  },
];

const DEPT_BADGE_CLASS = {
  Tech: "cd-badge--tech",
  Design: "cd-badge--design",
  Marketing: "cd-badge--marketing",
  Content: "cd-badge--content",
  Media: "cd-badge--media",
};

const DEPT_OPTIONS = ["Tech", "Design", "Marketing", "Content", "Media"];

const ATTENDANCE_OPTIONS = [
  { value: "only-soc-fair", label: "Only Society fair" },
  { value: "only-tech-meet", label: "Only Tech meet" },
  { value: "both", label: "Both" },
  { value: "none", label: "None" },
];

// ─── Toast system ─────────────────────────────────────────────────────────────

let _toastId = 0;

function useToasts() {
  const [toasts, setToasts] = useState([]);
  function push(message, type = "success") {
    const id = ++_toastId;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }
  function dismiss(id) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }
  return { toasts, push, dismiss };
}

function ToastStack({ toasts, dismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="cd-toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`cd-toast cd-toast--${t.type}`}>
          <span className="cd-toast-icon">
            {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "!"}
          </span>
          <span className="cd-toast-msg">{t.message}</span>
          <button
            className="cd-toast-close"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function QRCardHeader() {
  return (
    <div className="cd-card-header">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="5" height="5" rx="1" />
        <rect x="16" y="3" width="5" height="5" rx="1" />
        <rect x="3" y="16" width="5" height="5" rx="1" />
        <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
        <path d="M21 21v.01" />
        <path d="M12 7v3a2 2 0 0 1-2 2H7" />
        <path d="M3 12h.01" />
        <path d="M12 3h.01" />
        <path d="M12 16v.01" />
        <path d="M16 12h1" />
      </svg>
      <h3>Your Entry QR Code</h3>
    </div>
  );
}

function QRCard({ qrToken, slotInfo }) {
  const [enlarged, setEnlarged] = useState(false);
  const { status, unlockAt, slotDateTime } = useQrUnlockState(slotInfo);

  if (!qrToken) return null;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrToken)}&bgcolor=ffffff&color=08284d&margin=12`;
  const qrUrlLarge = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrToken)}&bgcolor=ffffff&color=08284d&margin=16`;

  // Build the early-scan warning banner text when slot is scheduled but not yet within 30 min
  let earlyBanner = null;
  if (status === "locked" && unlockAt && slotDateTime) {
    const slotDateStr = formatSlotDate(slotInfo?.slotDate);
    const slotTimeStr = formatSlotTime(slotInfo?.startTime);
    earlyBanner = {
      slotLabel: [slotDateStr, slotTimeStr].filter(Boolean).join(" at "),
      unlockLabel: formatUnlockMoment(unlockAt),
    };
  }

  return (
    <>
      <div className="cd-card">
        <QRCardHeader />
        <div className="cd-qr-body">
          {/* QR is ALWAYS visible — never hidden */}
          <button
            className="cd-qr-wrap cd-qr-wrap--clickable"
            onClick={() => setEnlarged(true)}
            aria-label="Tap to enlarge QR code"
            title="Tap to enlarge"
          >
            <img
              src={qrUrl}
              alt="Entry QR code"
              className="cd-qr-img"
              width={200}
              height={200}
            />
          </button>
          <div className="cd-qr-info">
            {/* Early-scan warning — shown when slot is set but window hasn't opened */}
            {earlyBanner ? (
              <div className="cd-qr-early-warning">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <div>
                  <strong>
                    Your slot is scheduled for {earlyBanner.slotLabel}
                  </strong>
                  <p>
                    This QR code will only be accepted from{" "}
                    <strong>{earlyBanner.unlockLabel}</strong> onwards —
                    {QR_UNLOCK_MINUTES_BEFORE} minutes before your slot.
                    Scanning it earlier will not mark attendance.
                  </p>
                </div>
              </div>
            ) : status === "unscheduled" ? (
              <div className="cd-qr-early-warning cd-qr-early-warning--info">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div>
                  <strong>Slot date &amp; time not yet configured</strong>
                  <p>
                    The admin hasn't set a date and time for your slot yet. Your
                    QR code is ready — you'll be able to use it once the
                    schedule is confirmed.
                  </p>
                </div>
              </div>
            ) : (
              <p className="cd-qr-hint">
                Show this QR code at the venue to mark your attendance. Keep
                this screen visible or take a screenshot before the test.
              </p>
            )}
            <p className="cd-qr-tap-hint">Tap the QR code to enlarge it.</p>
          </div>
        </div>
      </div>

      {enlarged && (
        <div className="cd-modal-backdrop" onClick={() => setEnlarged(false)}>
          <div
            className="cd-modal cd-qr-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Enlarged QR code"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cd-modal-header">
              <h2>Entry QR Code</h2>
              <button
                className="cd-modal-close"
                onClick={() => setEnlarged(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="cd-qr-modal-body">
              {earlyBanner && (
                <div className="cd-qr-early-warning cd-qr-early-warning--modal">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <div>
                    <strong>Slot: {earlyBanner.slotLabel}</strong>
                    <p>Accepted from {earlyBanner.unlockLabel} onwards.</p>
                  </div>
                </div>
              )}
              <img
                src={qrUrlLarge}
                alt="Entry QR code enlarged"
                className="cd-qr-img-large"
              />
              <p
                className="cd-qr-hint"
                style={{ textAlign: "center", padding: "0 24px 24px" }}
              >
                Present this at the venue entrance for attendance.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DeptBadge({ dept, secondary = false }) {
  if (!dept) return null;
  const cls = DEPT_BADGE_CLASS[dept] ?? "cd-badge--tech";
  return (
    <span
      className={`cd-badge ${cls}${secondary ? " cd-badge--secondary" : ""}`}
    >
      {dept}
      {secondary && <span className="cd-badge-label">2nd</span>}
    </span>
  );
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`cd-faq-item${open ? " open" : ""}`}>
      <button className="cd-faq-btn" onClick={() => setOpen((o) => !o)}>
        {q}
        <svg
          className="cd-faq-chevron"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div className="cd-faq-answer">
        <p>{a}</p>
      </div>
    </div>
  );
}

// ─── Edit modal — all fields except password ──────────────────────────────────

function EditModal({ profile, token, onClose, onSaved, onLocked }) {
  const isLocked = profile.form_locked === true;

  const [fields, setFields] = useState({
    full_name: profile.full_name ?? "",
    date_of_birth: profile.date_of_birth ?? "",
    attendance: profile.attendance ?? "",
    primary_department: profile.primary_department ?? "",
    secondary_department: profile.secondary_department ?? "",
    join_reason: profile.join_reason ?? "",
    other_societies: profile.other_societies ?? "",
    recruit_reason: profile.recruit_reason ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key, value) {
    setFields((f) => {
      const next = { ...f, [key]: value };
      // Clear secondary if it matches new primary
      if (key === "primary_department" && next.secondary_department === value) {
        next.secondary_department = "";
      }
      return next;
    });
  }

  async function handleSave() {
    if (!fields.full_name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!fields.primary_department) {
      setError("Primary department is required.");
      return;
    }
    if (fields.primary_department === fields.secondary_department) {
      setError("Primary and secondary departments must differ.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await updateCandidateDetails(fields, token);
      onSaved(res.profile);
      onClose();
    } catch (err) {
      if (err.message?.toLowerCase().includes("locked")) {
        onLocked();
        onClose();
      } else {
        setError(err.message || "Failed to save. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  const secondaryOptions = DEPT_OPTIONS.filter(
    (d) => d !== fields.primary_department,
  );

  return (
    <div
      className="cd-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="cd-modal cd-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
      >
        <div className="cd-modal-header">
          <h2 id="edit-modal-title">Edit Details</h2>
          <button
            className="cd-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {isLocked ? (
          <div className="cd-modal-body">
            <div className="cd-lock-notice">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <div>
                <strong>Form Locked</strong>
                <p>
                  An admin has locked your form. No further changes can be made.
                  Contact support if you think this is an error.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="cd-modal-body cd-modal-body--grid">
              <div className="cd-field">
                <label htmlFor="edit-name">Full Name</label>
                <input
                  id="edit-name"
                  type="text"
                  value={fields.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                />
              </div>

              <div className="cd-field">
                <label htmlFor="edit-email">Email</label>
                <input
                  id="edit-email"
                  type="email"
                  value={profile.email ?? ""}
                  disabled
                  title="Email cannot be changed"
                />
              </div>

              <div className="cd-field">
                <label htmlFor="edit-dob">Date of Birth</label>
                <input
                  id="edit-dob"
                  type="date"
                  value={fields.date_of_birth}
                  onChange={(e) => set("date_of_birth", e.target.value)}
                />
              </div>

              <div className="cd-field">
                <label htmlFor="edit-attendance">
                  Tech Meet &amp; Society Fair Attendance
                </label>
                <select
                  id="edit-attendance"
                  value={fields.attendance}
                  onChange={(e) => set("attendance", e.target.value)}
                >
                  <option value="">Select one</option>
                  {ATTENDANCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cd-field">
                <label htmlFor="edit-primary">Primary Department</label>
                <select
                  id="edit-primary"
                  value={fields.primary_department}
                  onChange={(e) => set("primary_department", e.target.value)}
                >
                  <option value="">Select a department</option>
                  {DEPT_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cd-field">
                <label htmlFor="edit-secondary">Secondary Department</label>
                <select
                  id="edit-secondary"
                  value={fields.secondary_department}
                  onChange={(e) => set("secondary_department", e.target.value)}
                >
                  <option value="">Select a department</option>
                  {secondaryOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cd-field cd-field--full">
                <label htmlFor="edit-join">Why do you want to join MLSC?</label>
                <textarea
                  id="edit-join"
                  rows={3}
                  value={fields.join_reason}
                  onChange={(e) => set("join_reason", e.target.value)}
                />
              </div>

              <div className="cd-field cd-field--full">
                <label htmlFor="edit-societies">
                  Other societies you are part of
                </label>
                <textarea
                  id="edit-societies"
                  rows={2}
                  value={fields.other_societies}
                  onChange={(e) => set("other_societies", e.target.value)}
                />
              </div>

              <div className="cd-field cd-field--full">
                <label htmlFor="edit-recruit">Why should we recruit you?</label>
                <textarea
                  id="edit-recruit"
                  rows={3}
                  value={fields.recruit_reason}
                  onChange={(e) => set("recruit_reason", e.target.value)}
                />
              </div>
            </div>

            {error && <p className="cd-modal-error">{error}</p>}

            <div className="cd-modal-footer">
              <button className="cd-btn cd-btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                className="cd-btn cd-btn--primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { candidateProfile, authSession, saveProfile, logout } = useAuth();
  const [profile, setProfile] = useState(candidateProfile ?? {});
  const [showEdit, setShowEdit] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  // Resolve slot info (day, num, venue, date, time) from the UUID stored in profile
  const slotInfo = useSlotInfo(profile.slot_id ?? null);

  // Fire success toast once on arrival from CandidateDetails, then clear state
  useEffect(() => {
    const msg = location.state?.successMessage;
    if (msg) {
      push(msg, "success");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const initials = (profile.full_name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const status = profile.application_status ?? "Pending";
  const statusKey = status.toLowerCase();
  const isLocked = profile.form_locked === true;

  function handleSaved(updatedProfile) {
    const merged = { ...profile, ...updatedProfile };
    setProfile(merged);
    saveProfile(merged);
    push("Details updated successfully.", "success");
  }

  function handleLockedByServer() {
    setProfile((p) => ({ ...p, form_locked: true }));
    push(
      "Your form has been locked by an admin. No further changes can be made.",
      "error",
    );
  }

  if (!profile.application_number) {
    return (
      <main className="cd">
        <div className="cd-loading">
          <div className="cd-spinner">
            <span />
            <span />
            <span />
          </div>
          <p>Loading your application…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="cd">
      <ToastStack toasts={toasts} dismiss={dismiss} />

      {/* ── Header ── */}
      <header className="cd-header">
        <div className="cd-brand">
          <div className="cd-logo">
            <img src={mlscLogo} alt="MLSC Logo" />
          </div>
          <div>
            <h1>MLSC Recruitment</h1>
            <p className="cd-header-sub">Your application dashboard</p>
          </div>
        </div>
        <button
          className="cd-btn cd-btn--danger-ghost"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </header>

      {/* ── Welcome banner ── */}
      <div className="cd-welcome">
        <div className="cd-welcome-text">
          <h2>
            Welcome back, {profile.full_name?.split(" ")[0] ?? "Candidate"}
          </h2>
          <p>View your application details and test schedule below.</p>
          <div className={`cd-app-status cd-app-status--${statusKey}`}>
            <span className="cd-app-status-dot" />
            {status}
          </div>
        </div>
        <div className="cd-welcome-avatar" aria-hidden="true">
          {initials}
        </div>
      </div>

      {/* ── Form locked banner ── */}
      {isLocked && (
        <div className="cd-locked-banner">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <div>
            <strong>Form Locked</strong>
            <span>
              An admin has locked your application. No further edits are
              allowed.
            </span>
          </div>
        </div>
      )}

      {/* ── Application Details ── */}
      <div className="cd-card">
        <div className="cd-card-header">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <h3>Application Details</h3>
        </div>

        <div className="cd-details-grid">
          <div className="cd-detail-item">
            <span className="cd-detail-label">Application No.</span>
            <span className="cd-detail-value cd-detail-value--mono">
              {profile.application_number}
            </span>
          </div>
          <div className="cd-detail-item">
            <span className="cd-detail-label">Full Name</span>
            <span className="cd-detail-value">{profile.full_name}</span>
          </div>
          <div className="cd-detail-item">
            <span className="cd-detail-label">Email</span>
            <span className="cd-detail-value">{profile.email}</span>
          </div>
          <div className="cd-detail-item">
            <span className="cd-detail-label">Date of Birth</span>
            <span className="cd-detail-value">{profile.date_of_birth}</span>
          </div>
          <div className="cd-detail-item">
            <span className="cd-detail-label">Attendance</span>
            <span className="cd-detail-value">
              {ATTENDANCE_OPTIONS.find((o) => o.value === profile.attendance)
                ?.label ?? profile.attendance}
            </span>
          </div>
          <div className="cd-detail-item">
            <span className="cd-detail-label">Primary Preference</span>
            <div className="cd-dept-badges">
              <DeptBadge dept={profile.primary_department} />
            </div>
          </div>
          <div className="cd-detail-item">
            <span className="cd-detail-label">Secondary Preference</span>
            <div className="cd-dept-badges">
              <DeptBadge dept={profile.secondary_department} secondary />
            </div>
          </div>
          <div className="cd-detail-item cd-detail-item--wide">
            <span className="cd-detail-label">Why MLSC?</span>
            <span className="cd-detail-value cd-detail-value--prose">
              {profile.join_reason}
            </span>
          </div>
          <div className="cd-detail-item cd-detail-item--wide">
            <span className="cd-detail-label">Other Societies</span>
            <span className="cd-detail-value cd-detail-value--prose">
              {profile.other_societies}
            </span>
          </div>
          <div className="cd-detail-item cd-detail-item--wide">
            <span className="cd-detail-label">Why Should We Recruit You?</span>
            <span className="cd-detail-value cd-detail-value--prose">
              {profile.recruit_reason}
            </span>
          </div>
        </div>

        <div className="cd-card-actions">
          <button
            className={`cd-btn ${isLocked ? "cd-btn--ghost" : "cd-btn--primary"}`}
            onClick={() => setShowEdit(true)}
            title={isLocked ? "Form has been locked by admin" : undefined}
          >
            {isLocked ? (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Form Locked
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit Details
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── QR Code ── */}
      <QRCard qrToken={profile.qr_token} slotInfo={slotInfo} />

      {/* ── Slot Assignment ── */}
      {(() => {
        const sid = profile.slot_id;

        // No slot assigned yet
        if (!sid) {
          return (
            <div className="cd-card">
              <div className="cd-card-header">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <h3>Slot Assigned</h3>
              </div>
              <div className="cd-slot-pending">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Slot not assigned yet. Check back after some time.
              </div>
            </div>
          );
        }

        // Slot assigned but still resolving from server
        if (slotInfo === undefined) {
          return (
            <div className="cd-card">
              <div className="cd-card-header">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <h3>Your Assigned Slot</h3>
              </div>
              <div className="cd-slot-pending">Loading slot details…</div>
            </div>
          );
        }

        // Slot resolved
        const dateLabel = formatSlotDate(slotInfo.slotDate);
        const timeLabel = formatSlotTime(slotInfo.startTime);

        return (
          <div className="cd-card cd-card--slot">
            <div className="cd-card-header">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <h3>Your Assigned Slot</h3>
            </div>
            <div className="cd-schedule-grid">
              <div className="cd-schedule-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="cd-schedule-value">Day {slotInfo.day}</span>
                {dateLabel && (
                  <span className="cd-schedule-sub">{dateLabel}</span>
                )}
                <span className="cd-schedule-label">Day</span>
              </div>
              <div className="cd-schedule-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="cd-schedule-value">Slot {slotInfo.num}</span>
                {timeLabel && (
                  <span className="cd-schedule-sub">{timeLabel}</span>
                )}
                <span className="cd-schedule-label">Slot</span>
              </div>
              <div className="cd-schedule-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span className="cd-schedule-value">{slotInfo.venue}</span>
                <span className="cd-schedule-label">Venue</span>
              </div>
            </div>
            <p className="cd-slot-note">
              Please arrive at the venue on time. Bring your college ID and show
              the QR code above for attendance.
            </p>
          </div>
        );
      })()}

      {/* ── FAQ ── */}
      <div className="cd-card">
        <div className="cd-card-header">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <h3>Frequently Asked Questions</h3>
        </div>
        <div className="cd-faq-list">
          {FAQS.map((faq) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </div>

      {/* ── Contact Support ── */}
      <div className="cd-card">
        <div className="cd-card-header">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <h3>Contact Support</h3>
        </div>
        <div className="cd-support-grid">
          <div className="cd-support-item">
            <div className="cd-support-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div className="cd-support-info">
              <span className="cd-detail-label">Email</span>
              <a
                href={`mailto:${SUPPORT.email}`}
                className="cd-detail-value"
                style={{ color: "#2663e7", textDecoration: "none" }}
              >
                {SUPPORT.email}
              </a>
            </div>
          </div>
          <div className="cd-support-item">
            <div className="cd-support-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div className="cd-support-info">
              <span className="cd-detail-label">Phone</span>
              <a
                href={`tel:${SUPPORT.phone.replace(/\s/g, "")}`}
                className="cd-detail-value"
                style={{ color: "#2663e7", textDecoration: "none" }}
              >
                {SUPPORT.phone}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit modal ── */}
      {showEdit && (
        <EditModal
          profile={profile}
          token={authSession?.accessToken}
          onClose={() => setShowEdit(false)}
          onSaved={handleSaved}
          onLocked={handleLockedByServer}
        />
      )}
    </main>
  );
}
