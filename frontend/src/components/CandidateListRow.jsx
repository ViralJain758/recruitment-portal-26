import { formatSlotSummary } from "../utils/slotResolver";
import { normalizeBoolean } from "../utils/candidateHelpers";

const STATUS_CLASS = {
  pending: "status--pending",
  shortlisted: "status--shortlisted",
  rejected: "status--rejected",
};

const DEPT_CLASS = {
  Tech: "tag--tech",
  Technical: "tag--tech",
  Design: "tag--design",
  Marketing: "tag--marketing",
  Content: "tag--content",
  Media: "tag--media",
};

export default function CandidateListRow({
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
  const isPresent = normalizeBoolean(candidate.quiz_attended);

  return (
    <div
      className={`applicant-row ${statusKey ? `applicant-row--${statusKey}` : ""}`}
      onClick={() => onSelect(candidate)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect(candidate)}
    >
      <div className="row-avatar" aria-hidden="true">
        {initials}
      </div>

      <div className="row-identity">
        <span className="row-name">{candidate.full_name}</span>
        <span className="row-email">{candidate.email}</span>
      </div>

      <span className="row-app-no">#{candidate.application_number}</span>

      <div className="row-depts">
        {candidate.primary_department && (
          <span
            className={`tag tag--sm ${DEPT_CLASS[candidate.primary_department] ?? "tag--tech"}`}
          >
            {candidate.primary_department}
          </span>
        )}
        {candidate.secondary_department && (
          <span
            className={`tag tag--sm ${DEPT_CLASS[candidate.secondary_department] ?? "tag--tech"} tag--secondary-dept`}
          >
            {candidate.secondary_department}
          </span>
        )}
      </div>

      <span className={`row-slot ${slotLabel ? "" : "row-slot--none"}`}>
        {slotLabel || "No slot"}
      </span>

      {candidate.slot_id ? (
        <span
          className={`row-attendance ${isPresent ? "row-attendance--present" : "row-attendance--absent"}`}
        >
          {isPresent ? "Present" : "Absent"}
        </span>
      ) : (
        <span className="row-attendance row-attendance--none">—</span>
      )}

      <span className="row-score">
        {hasScore ? (
          <>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 18.77 5.82 21.02 7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {candidate.quiz_score}
          </>
        ) : (
          "—"
        )}
      </span>

      <span className={`status-badge status-badge--sm ${STATUS_CLASS[statusKey] ?? ""}`}>
        {candidate.application_status}
      </span>

      <div className="row-actions">
        {candidate.quiz_submitted_at && (
          <button
            className="row-reset-btn"
            onClick={(e) => {
              e.stopPropagation();
              onResetQuiz?.(candidate);
            }}
            title={`Reset quiz for ${candidate.full_name || "this candidate"}`}
            aria-label={`Reset quiz for ${candidate.full_name || "this candidate"}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
        )}
        <svg
          className="row-chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  );
}
