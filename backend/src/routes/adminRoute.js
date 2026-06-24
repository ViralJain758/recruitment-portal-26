import express from "express";
import {
  getAllCandidates,
  updateCandidateStatus,
  updateCandidateAttendance,
  deleteCandidateById,
  markCandidateAttendance,
  getAttendanceStats,
  lockCandidateForm,
  individualUnlockCandidate,
  updateOwnDetails,
  getGlobalLockStatus,
  setGlobalLockStatus,
  distributeSlotHandler,
  getSlotSummaryHandler,
  clearSlotsHandler,
  getSlotSchedulesHandler,
  setDayDateHandler,
  setSlotTimeHandler,
  addDayHandler,
  removeDayHandler,
  addSlotHandler,
  removeSlotHandler,
} from "../controllers/adminController.js";

const router = express.Router();

router.get("/candidates", getAllCandidates);
router.patch("/candidates/:id/status", updateCandidateStatus);
router.patch("/candidates/:id/attendance", updateCandidateAttendance);
router.patch("/candidates/:id/lock", lockCandidateForm);
router.patch("/candidates/:id/individual-unlock", individualUnlockCandidate);
router.delete("/candidates/:id", deleteCandidateById);

router.post("/attendance", markCandidateAttendance);
router.get("/attendance/stats", getAttendanceStats);
router.patch("/candidate-details", updateOwnDetails);

// Global form lock
router.get("/global-lock", getGlobalLockStatus);
router.patch("/global-lock", setGlobalLockStatus);

// Slot distribution
router.post("/slots/distribute", distributeSlotHandler);
router.get("/slots/summary", getSlotSummaryHandler);
router.delete("/slots", clearSlotsHandler);

// Slot schedules (day dates + slot times) — dynamic
router.get("/slots/schedules", getSlotSchedulesHandler);
router.post("/slots/schedules/day", addDayHandler);
router.patch("/slots/schedules/day/:day", setDayDateHandler);
router.delete("/slots/schedules/day/:day", removeDayHandler);
router.post("/slots/schedules/slot", addSlotHandler);
router.patch("/slots/schedules/slot/:slot", setSlotTimeHandler);
router.delete("/slots/schedules/slot/:slot", removeSlotHandler);

export default router;
