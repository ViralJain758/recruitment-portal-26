import express from "express";
import {
  getAllCandidates,
  updateCandidateStatus,
  updateCandidateAttendance,
  assignCandidateSlotHandler,
  resetCandidateQuizHandler,
  deleteCandidateById,
  markCandidateAttendance,
  getAttendanceStats,
  lockCandidateForm,
  individualUnlockCandidate,
  updateOwnDetails,
  getGlobalLockStatus,
  setGlobalLockStatus,
  getRegistrationDeadlineStatus,
  setRegistrationDeadlineStatus,
  distributeSlotHandler,
  getSlotSummaryHandler,
  clearSlotsHandler,
  setSlotActiveHandler,
  getSlotSchedulesHandler,
  setDayDateHandler,
  setSlotTimeHandler,
  addDayHandler,
  removeDayHandler,
  addSlotHandler,
  removeSlotHandler,
  getQuizQuestionBankHandler,
  upsertQuizQuestionBankHandler,
  requireAdminSession,
  requireScannerPassword,
  verifyScannerPassword,
} from "../controllers/adminController.js";
import {
  adminReadLimiter,
  adminWriteLimiter,
  candidateDetailsLimiter,
  publicStatusLimiter,
  scannerLimiter,
} from "../middleware/rateLimiters.js";
import { blockKnownBots, slowDown } from "../middleware/botProtection.js";

const router = express.Router();

// ── Candidate data (admin session) ───────────────────────────────────────
// adminReadLimiter/adminWriteLimiter sit on top of requireAdminSession.
// They don't guard against an anonymous attacker (the session check already
// does that) — they blunt scripted scraping/mutation via a stolen or
// replayed admin session, and catch a misbehaving internal script.
router.get("/candidates", requireAdminSession, adminReadLimiter, getAllCandidates);
router.patch("/candidates/:id/status", requireAdminSession, adminWriteLimiter, updateCandidateStatus);
router.patch(
  "/candidates/:id/attendance",
  requireAdminSession,
  adminWriteLimiter,
  updateCandidateAttendance,
);
router.patch(
  "/candidates/:id/slot",
  requireAdminSession,
  adminWriteLimiter,
  assignCandidateSlotHandler,
);
router.post(
  "/candidates/:id/reset-quiz",
  requireAdminSession,
  adminWriteLimiter,
  resetCandidateQuizHandler,
);
router.patch("/candidates/:id/lock", requireAdminSession, adminWriteLimiter, lockCandidateForm);
router.patch(
  "/candidates/:id/individual-unlock",
  requireAdminSession,
  adminWriteLimiter,
  individualUnlockCandidate,
);
router.delete("/candidates/:id", requireAdminSession, adminWriteLimiter, deleteCandidateById);

router.post("/scanner/verify-password", blockKnownBots, slowDown("scanner"), scannerLimiter, verifyScannerPassword);
router.post("/attendance", requireScannerPassword, adminWriteLimiter, markCandidateAttendance);
router.get("/attendance/stats", requireScannerPassword, adminReadLimiter, getAttendanceStats);

// Candidate's own profile edit — bearer-token authenticated (not an admin
// session) despite the /admin path, so it gets the same bot/slow-down
// treatment as the other candidate-facing write endpoints.
router.patch(
  "/candidate-details",
  blockKnownBots,
  slowDown("candidate_details"),
  candidateDetailsLimiter,
  updateOwnDetails,
);

// Global form lock — read side is unauthenticated (candidate dashboards
// poll it), so it needs its own floor independent of admin auth.
router.get("/global-lock", publicStatusLimiter, getGlobalLockStatus);
router.patch("/global-lock", requireAdminSession, adminWriteLimiter, setGlobalLockStatus);

// Registration & edit deadline — read side is unauthenticated (candidate
// dashboards fetch it on load), same reasoning as global-lock above.
router.get("/registration-deadline", publicStatusLimiter, getRegistrationDeadlineStatus);
router.patch(
  "/registration-deadline",
  requireAdminSession,
  adminWriteLimiter,
  setRegistrationDeadlineStatus,
);

// Slot distribution
router.post("/slots/distribute", requireAdminSession, adminWriteLimiter, distributeSlotHandler);
router.get("/slots/summary", requireAdminSession, adminReadLimiter, getSlotSummaryHandler);
router.delete("/slots", requireAdminSession, adminWriteLimiter, clearSlotsHandler);
router.patch("/slots/:slotId/active", requireAdminSession, adminWriteLimiter, setSlotActiveHandler);

// Slot schedules (day dates + slot times) — dynamic
router.get("/slots/schedules", requireAdminSession, adminReadLimiter, getSlotSchedulesHandler);
router.post("/slots/schedules/day", requireAdminSession, adminWriteLimiter, addDayHandler);
router.patch("/slots/schedules/day/:day", requireAdminSession, adminWriteLimiter, setDayDateHandler);
router.delete("/slots/schedules/day/:day", requireAdminSession, adminWriteLimiter, removeDayHandler);
router.post("/slots/schedules/slot", requireAdminSession, adminWriteLimiter, addSlotHandler);
router.patch("/slots/schedules/slot/:slot", requireAdminSession, adminWriteLimiter, setSlotTimeHandler);
router.delete("/slots/schedules/slot/:slot", requireAdminSession, adminWriteLimiter, removeSlotHandler);

// Quiz question bank — GET returns the full bank in one shot, exactly the
// kind of endpoint scripted scraping targets, hence adminReadLimiter here
// too even though it's already session-gated.
router.get("/quiz/questions", requireAdminSession, adminReadLimiter, getQuizQuestionBankHandler);
router.put("/quiz/questions", requireAdminSession, adminWriteLimiter, upsertQuizQuestionBankHandler);
router.post("/quiz/questions", requireAdminSession, adminWriteLimiter, upsertQuizQuestionBankHandler);

export default router;
