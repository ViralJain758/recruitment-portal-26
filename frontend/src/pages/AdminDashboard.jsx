import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

import mlscLogo from "../assets/MLSC-logo.png";

import CandidateCard from "../components/CandidateCard";
import CandidateListRow from "../components/CandidateListRow";
import CandidateDrawer from "../components/CandidateDrawer";
import StatsGrid from "../components/StatsGrid";
import SlotDistribution from "../components/SlotDistribution";
import { formatSlotSummary } from "../utils/slotResolver";

import { useCandidates } from "../hooks/useCandidates";
import { useCandidateFilters } from "../hooks/useCandidateFilters";
import { logoutSession } from "../lib/api";
import { calculateStats } from "../utils/candidateHelpers";

// datetime-local inputs need "YYYY-MM-DDTHH:mm" in local time; Date's
// toISOString() gives UTC, so build the string from local getters instead.
function toDatetimeLocalValue(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [deadlineDraft, setDeadlineDraft] = useState("");
  const [deadlineDirty, setDeadlineDirty] = useState(false);
  const [viewMode, setViewMode] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("adminCandidateView") || "tiles"
      : "tiles",
  );

  const setAndPersistViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("adminCandidateView", mode);
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
  };

  const {
    candidates,
    loading,
    fetchCandidates,
    updateStatus,
    updateAttendance,
    resetQuiz,
    removeCandidate,
    toggleLock,
    individualUnlock,
    globalLocked,
    globalLockLoading,
    toggleGlobalLock,
    registrationDeadline,
    deadlineLoading,
    updateRegistrationDeadline,
    slotSummary,
    slotLoading,
    runDistributeSlots,
    runClearSlots,
    toggleSlotActivation,
    slotSchedules,
    schedulesLoading,
    saveDayDate,
    saveSlotTime,
    assignCandidateSlot,
    addDay,
    removeDay,
    addSlot,
    removeSlot,
  } = useCandidates();

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    deptSort,
    setDeptSort,
    slotSort,
    setSlotSort,
    attendanceFilter,
    setAttendanceFilter,
    filteredCandidates,
  } = useCandidateFilters(candidates);

  const stats = useMemo(() => calculateStats(candidates), [candidates]);

  useEffect(() => {
    const isAdmin = localStorage.getItem("isAdmin") === "true";
    if (!isAdmin) {
      alert("Unauthorized Access");
      window.location.reload();
    }
  }, []);

  // Keep the draft input in sync with the server value, but don't clobber
  // the admin's in-progress edit once they've started changing it.
  useEffect(() => {
    if (!deadlineDirty && registrationDeadline) {
      setDeadlineDraft(toDatetimeLocalValue(registrationDeadline));
    }
  }, [registrationDeadline, deadlineDirty]);

  const handleSaveDeadline = async () => {
    if (!deadlineDraft) return;
    const result = await updateRegistrationDeadline(
      new Date(deadlineDraft).toISOString(),
    );
    if (result) setDeadlineDirty(false);
  };

  useEffect(() => {
    const hadDarkTheme = document.documentElement.classList.contains("dark");
    document.documentElement.classList.remove("dark");
    document.body.classList.add("admin-light-mode");

    return () => {
      document.body.classList.remove("admin-light-mode");
      if (hadDarkTheme) {
        document.documentElement.classList.add("dark");
      }
    };
  }, []);

  const logout = async () => {
    await logoutSession().catch(() => {});
    localStorage.removeItem("isAdmin");
    window.location.reload();
  };

  const handleResetCandidateQuiz = async (candidate) => {
    const confirmed = window.confirm(
      `Reset quiz for ${candidate.full_name || "this candidate"}? This will clear the previous score and allow them to retake the test.`,
    );

    if (!confirmed) return;

    await resetQuiz(candidate.id);
  };

  return (
    <div className="dashboard admin-dashboard-light">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">
            <img src={mlscLogo} alt="MLSC Logo" />
          </div>
          <div>
            <h1>MLSC Recruitment</h1>
            <p className="header-subtitle">Manage &amp; review applications</p>
          </div>
        </div>

        <div className="header-controls">
          <div className="search-wrap">
            <svg
              className="search-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search candidates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="header-actions">
            {/* ── Global Lock Toggle ── */}
            <button
              className={`btn ${globalLocked ? "btn--danger" : "btn--warning"}`}
              onClick={() => toggleGlobalLock(!globalLocked)}
              disabled={globalLockLoading}
              title={
                globalLocked
                  ? "Click to unlock all registrations"
                  : "Click to lock all registrations"
              }
            >
              {globalLocked ? (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  {globalLockLoading
                    ? "Unlocking…"
                    : "Locked (Click to Unlock)"}
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                  </svg>
                  {globalLockLoading ? "Locking…" : "Lock All Forms"}
                </>
              )}
            </button>

            {/* ── Registration & edit deadline ── */}
            <div className="deadline-editor">
              <label htmlFor="registration-deadline-input">
                Registration deadline
              </label>
              <input
                id="registration-deadline-input"
                type="datetime-local"
                value={deadlineDraft}
                onChange={(e) => {
                  setDeadlineDraft(e.target.value);
                  setDeadlineDirty(true);
                }}
              />
              <button
                type="button"
                className="btn btn--secondary"
                onClick={handleSaveDeadline}
                disabled={deadlineLoading || !deadlineDraft}
                title="Save the registration & edit deadline"
              >
                {deadlineLoading ? "Saving…" : "Save"}
              </button>
            </div>

            <button
              className="btn btn--secondary"
              onClick={() => navigate("/scanner")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
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
              Scanner
            </button>

            <button
              className="btn btn--ghost"
              onClick={fetchCandidates}
              title="Refresh candidates"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Refresh
            </button>

            <button className="btn btn--danger-ghost" onClick={logout}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
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
          </div>
        </div>
      </header>

      {/* ── Stats ── */}
      <StatsGrid
        stats={stats}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      {/* ── Global lock banner ── */}
      {globalLocked && (
        <div className="lock-banner">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          All candidate forms are locked and new sign-ups are disabled.
        </div>
      )}

      {/* ── Slot Distribution ── */}
      <SlotDistribution
        summary={slotSummary}
        slotLoading={slotLoading}
        totalCandidates={candidates.length}
        onDistribute={runDistributeSlots}
        onClear={runClearSlots}
        onToggleSlotActivation={toggleSlotActivation}
        schedules={slotSchedules}
        schedulesLoading={schedulesLoading}
        onSaveDayDate={saveDayDate}
        onSaveSlotTime={saveSlotTime}
        onAddDay={addDay}
        onRemoveDay={removeDay}
        onAddSlot={addSlot}
        onRemoveSlot={removeSlot}
      />

      {/* ── Candidates section ── */}
      <div className="section-header">
        <div className="section-title">
          <h2>
            {statusFilter === "All"
              ? "All Candidates"
              : `${statusFilter} Candidates`}
            {attendanceFilter !== "All" ? ` · ${attendanceFilter}` : ""}
          </h2>
          {!loading && (
            <span className="count-badge">{filteredCandidates.length}</span>
          )}
        </div>

        <div className="filters-toolbar">
          <div className="filter-select-wrap">
            <svg
              className="filter-select-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="21" y1="10" x2="3" y2="10" />
              <line x1="21" y1="6" x2="3" y2="6" />
              <line x1="21" y1="14" x2="3" y2="14" />
              <line x1="21" y1="18" x2="3" y2="18" />
            </svg>
            <select
              value={deptSort}
              onChange={(e) => setDeptSort(e.target.value)}
              aria-label="Filter by department"
            >
              <option value="All">All Departments</option>
              <option value="Tech">Tech</option>
              <option value="Design">Design</option>
              <option value="Marketing">Marketing</option>
              <option value="Content">Content</option>
              <option value="Media">Media</option>
            </select>
          </div>

          <div className="filter-select-wrap">
            <svg
              className="filter-select-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="16" y1="2" x2="16" y2="6" />
            </svg>
            <select
              value={slotSort}
              onChange={(e) => setSlotSort(e.target.value)}
              aria-label="Filter by slot"
            >
              <option value="All">All Slots</option>
              <option value="Assigned">Assigned Slots</option>
              <option value="Unassigned">Unassigned Slots</option>
              {Array.isArray(slotSummary) && slotSummary.length > 0 ? (
                <optgroup label="By Slot">
                  {slotSummary.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatSlotSummary(s.id, slotSummary, slotSchedules) ||
                        `Day ${s.slot_day} · Slot ${s.slot_number} · ${s.slot_venue}`}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </div>

          <div className="filter-select-wrap">
            <svg
              className="filter-select-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <select
              value={attendanceFilter}
              onChange={(e) => setAttendanceFilter(e.target.value)}
              aria-label="Filter by attendance"
            >
              <option value="All">Present &amp; Absent</option>
              <option value="Present">Present Only</option>
              <option value="Absent">Absent Only</option>
            </select>
          </div>

          <div
            className="view-toggle"
            role="group"
            aria-label="Switch candidate view"
          >
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === "tiles" ? "view-toggle-btn--active" : ""}`}
              onClick={() => setAndPersistViewMode("tiles")}
              title="Tile view"
              aria-pressed={viewMode === "tiles"}
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
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              <span>Tiles</span>
            </button>
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === "list" ? "view-toggle-btn--active" : ""}`}
              onClick={() => setAndPersistViewMode("list")}
              title="List view"
              aria-pressed={viewMode === "list"}
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
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
              <span>List</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p>Loading candidates…</p>
        </div>
      ) : (
        <div className={viewMode === "list" ? "rows-container" : "cards-container"}>
          {filteredCandidates.length ? (
            viewMode === "list" ? (
              <>
                <div className="row-header" aria-hidden="true">
                  <span className="row-header-avatar" />
                  <span className="row-header-identity">Candidate</span>
                  <span className="row-header-app-no">App No.</span>
                  <span className="row-header-depts">Departments</span>
                  <span className="row-header-slot">Slot</span>
                  <span className="row-header-attendance">Attendance</span>
                  <span className="row-header-score">Score</span>
                  <span className="row-header-status">Status</span>
                  <span className="row-header-actions" />
                </div>
                {filteredCandidates.map((candidate) => (
                  <CandidateListRow
                    key={candidate.id}
                    candidate={candidate}
                    onSelect={setSelectedCandidate}
                    slotSummary={slotSummary}
                    slotSchedules={slotSchedules}
                    onResetQuiz={handleResetCandidateQuiz}
                  />
                ))}
              </>
            ) : (
              filteredCandidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  onSelect={setSelectedCandidate}
                  slotSummary={slotSummary}
                  slotSchedules={slotSchedules}
                  onResetQuiz={handleResetCandidateQuiz}
                />
              ))
            )
          ) : (
            <div className="empty-candidates">
              <div className="empty-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <p className="empty-title">No candidates found</p>
              <p className="empty-sub">
                {search
                  ? `No results for "${search}" — try a different name or email.`
                  : "No candidates match the selected filter."}
              </p>
              {(search ||
                statusFilter !== "All" ||
                deptSort !== "All" ||
                slotSort !== "All" ||
                attendanceFilter !== "All") && (
                <button
                  className="btn btn--ghost empty-reset"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("All");
                    setDeptSort("All");
                    setSlotSort("All");
                    setAttendanceFilter("All");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <CandidateDrawer
        candidate={selectedCandidate}
        globalLocked={globalLocked}
        slotSummary={slotSummary}
        slotSchedules={slotSchedules}
        onClose={() => setSelectedCandidate(null)}
        onUpdateStatus={async (id, status) => {
          const updated = await updateStatus(id, status);
          if (updated) setSelectedCandidate(updated);
        }}
        onUpdateAttendance={async (id, present) => {
          const updated = await updateAttendance(id, present);
          if (updated) setSelectedCandidate(updated);
        }}
        onDelete={async (id) => {
          const ok = await removeCandidate(id);
          if (ok) setSelectedCandidate(null);
        }}
        onToggleLock={async (id, locked) => {
          const updated = await toggleLock(id, locked);
          if (updated) setSelectedCandidate(updated);
        }}
        onIndividualUnlock={async (id, unlocked) => {
          const updated = await individualUnlock(id, unlocked);
          if (updated) setSelectedCandidate(updated);
        }}
        onAssignSlot={async (id, slotId) => {
          const updated = await assignCandidateSlot(id, slotId);
          if (updated) setSelectedCandidate(updated);
        }}
      />
    </div>
  );
}
