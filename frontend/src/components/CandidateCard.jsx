import { formatSlotSummary } from "../utils/slotResolver";

const STATUS_CLASS = {
  pending: "status--pending",
  shortlisted: "status--shortlisted",
  rejected: "status--rejected",
};

// Unique color per department
const DEPT_CLASS = {
  Tech: "tag--tech",
  Technical: "tag--tech",
  Design: "tag--design",
  Marketing: "tag--marketing",
  Content: "tag--content",
  Media: "tag--media",
};

export default function CandidateCard({
  candidate,
  onSelect,
  slotSummary,
  slotSchedules,
  onResetQuiz,
}) {
  const initials = candidate.full_name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

  const statusKey = candidate.application_status?.toLowerCase();
  const slotLabel = formatSlotSummary(
    candidate.slot_id,
    slotSummary,
    slotSchedules,
  );
  const hasScore =
    candidate.quiz_score !== null && candidate.quiz_score !== undefined;

  return (
    <div
      className={`applicant-card ${statusKey ? `applicant-card--${statusKey}` : ""}`}
      onClick={() => onSelect(candidate)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect(candidate)}
    >
      {/* Top row: avatar + name + status badge */}
      <div className="card-header">
        <div className="avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="card-meta">
          <h2 className="card-name">{candidate.full_name}</h2>
          <p className="card-email">{candidate.email}</p>
        </div>
        <span className={`status-badge ${STATUS_CLASS[statusKey] ?? ""}`}>
          {candidate.application_status}
        </span>
      </div>

      {/* Department tags + score */}
      <div className="tags">
        {candidate.primary_department && (
          <span
            className={`tag ${DEPT_CLASS[candidate.primary_department] ?? "tag--tech"}`}
          >
            {candidate.primary_department}
          </span>
        )}
        {candidate.secondary_department && (
          <span
            className={`tag ${DEPT_CLASS[candidate.secondary_department] ?? "tag--tech"} tag--secondary-dept`}
          >
            {candidate.secondary_department}
          </span>
        )}
        {hasScore && (
          <span className="card-score-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 18.77 5.82 21.02 7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {candidate.quiz_score}
          </span>
        )}
      </div>

      {/* Footer: app number + slot badge + actions */}
      <div className="card-footer">
        <div className="card-footer-info">
          <span className="card-app-no">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            #{candidate.application_number}
          </span>
          {slotLabel && (
            <span className="card-slot-badge">
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
              {slotLabel}
            </span>
          )}
        </div>

        <div className="card-actions">
          {candidate.quiz_submitted_at && (
            <button
              className="card-reset-btn"
              onClick={(e) => {
                e.stopPropagation();
                onResetQuiz?.(candidate);
              }}
            >
              Reset Quiz
            </button>
          )}
          <span className="card-cta" aria-hidden="true">
            View details
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
