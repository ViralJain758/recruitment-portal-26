import { useMemo, useState, useEffect } from "react";
import "./AdminDashboard.css";

import mlscLogo from "../assets/MLSC-logo.png";

import CandidateCard from "../components/CandidateCard";
import CandidateDrawer from "../components/CandidateDrawer";
import StatsGrid from "../components/StatsGrid";
import AttendanceScanner from "../components/AttendanceScanner";
import SlotDistribution from "../components/SlotDistribution";

import { useCandidates } from "../hooks/useCandidates";
import { useCandidateFilters } from "../hooks/useCandidateFilters";
import { calculateStats } from "../utils/candidateHelpers";

export default function AdminDashboard() {
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const {
    candidates,
    loading,
    fetchCandidates,
    updateStatus,
    updateAttendance,
    removeCandidate,
    toggleLock,
    individualUnlock,
    globalLocked,
    globalLockLoading,
    toggleGlobalLock,
    slotSummary,
    slotLoading,
    runDistributeSlots,
    runClearSlots,
    slotSchedules,
    schedulesLoading,
    saveDayDate,
    saveSlotTime,
    addDay,
    removeDay,
    addSlot,
    removeSlot,
  } = useCandidates();

  const [showScanner, setShowScanner] = useState(false);

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    deptSort,
    setDeptSort,
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

  const logout = () => {
    localStorage.removeItem("isAdmin");
    window.location.reload();
  };

  return (
    <div className="dashboard">
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
                  ? "Click to unlock registrations globally"
                  : "Click to lock all registrations globally"
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
            <button
              className="btn btn--secondary"
              onClick={() => setShowScanner(true)}
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
        <div
          style={{
            margin: "0 0 16px",
            padding: "12px 20px",
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 10,
            color: "#b91c1c",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <svg
            width="18"
            height="18"
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
          Global Form Lock is active — all candidate forms are locked and new
          sign-ups are disabled.
        </div>
      )}

      {/* ── Slot Distribution ── */}
      <SlotDistribution
        summary={slotSummary}
        slotLoading={slotLoading}
        totalCandidates={candidates.length}
        onDistribute={runDistributeSlots}
        onClear={runClearSlots}
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
          </h2>
          {!loading && (
            <span className="count-badge">{filteredCandidates.length}</span>
          )}
        </div>

        <div className="dept-sort-wrap">
          <svg
            className="dept-sort-icon"
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
        <div className="cards-container">
          {filteredCandidates.length ? (
            filteredCandidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                onSelect={setSelectedCandidate}
                slotSummary={slotSummary}
                slotSchedules={slotSchedules}
              />
            ))
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
              {(search || statusFilter !== "All" || deptSort !== "All") && (
                <button
                  className="btn btn--ghost empty-reset"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("All");
                    setDeptSort("All");
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
      />

      {showScanner && (
        <AttendanceScanner onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
