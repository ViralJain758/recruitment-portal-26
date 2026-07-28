import {
  fetchAllCandidates,
  updateStatus,
  updateAttendance,
  deleteCandidate,
  markQuizAttendance,
  getAttendanceStatsService,
  toggleFormLock,
  setIndividualUnlock,
  updateCandidateDetails,
  getGlobalLock,
  setGlobalLock,
  distributeSlots,
  getSlotSummary,
  clearSlots,
  getSlotSchedules,
  setDayDate,
  setSlotTime,
  addDayToSchedule,
  removeDayFromSchedule,
  addSlotToSchedule,
  removeSlotFromSchedule,
} from "../services/adminService.js";
import { bearerToken, userFromToken } from "../services/authService.js";
import db from "../config/db.js";
import { deleteUserById } from "../models/authModel.js";

export async function getAllCandidates(req, res) {
  try {
    const data = await fetchAllCandidates();
    return res.json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: error.message || "Failed to fetch candidates",
    });
  }
}

export async function updateCandidateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const data = await updateStatus(id, status);
    req.app.get("io")?.emit("candidate:updated", data);

    return res.json({ message: "Status updated", data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: error.message || "Failed to update status",
    });
  }
}

export async function updateCandidateAttendance(req, res) {
  try {
    const { id } = req.params;
    const { present } = req.body;

    if (typeof present !== "boolean") {
      return res.status(400).json({ message: "`present` must be a boolean" });
    }

    const data = await updateAttendance(id, present);
    req.app.get("io")?.emit("candidate:updated", data);

    return res.json({ message: "Attendance updated", data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: error.message || "Failed to update attendance",
    });
  }
}

// ── FIX: Delete from users (not just candidate_profiles) so the email is
//         fully freed and the person can re-register with the same address.
//         ON DELETE CASCADE in the schema takes care of:
//           refresh_tokens, candidate_profiles, candidate_form,
//           candidate_status, candidate_quiz
export async function deleteCandidateById(req, res) {
  try {
    const { id } = req.params;

    // Resolve the users.id from the candidate_profiles.id that the frontend sends
    const cpResult = await db.execute({
      sql: "SELECT user_id FROM candidate_profiles WHERE id = ?",
      args: [Number(id)],
    });

    const row = cpResult.rows[0];
    if (!row) {
      return res.status(404).json({ message: "Candidate not found." });
    }

    // Single delete — cascade does the rest
    const { error } = await deleteUserById(row.user_id);
    if (error) {
      return res.status(500).json({ message: error.message });
    }

    req.app.get("io")?.emit("candidate:deleted", { id: Number(id) });
    return res.json({ message: "Candidate deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: error.message || "Failed to delete candidate",
    });
  }
}

export async function markCandidateAttendance(req, res) {
  try {
    const { qrToken } = req.body;
    const result = await markQuizAttendance(qrToken);

    req.app.get("io")?.emit("candidate:updated", result.candidate);

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(400).json({
      message: error.message || "Failed to mark attendance",
    });
  }
}

export async function getAttendanceStats(req, res) {
  try {
    const stats = await getAttendanceStatsService();
    return res.json(stats);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load attendance stats" });
  }
}

// ── Form lock (admin only) ─────────────────────────────────────────────────

export async function lockCandidateForm(req, res) {
  try {
    const { id } = req.params;
    const { locked } = req.body;

    if (typeof locked !== "boolean") {
      return res.status(400).json({ message: "`locked` must be a boolean" });
    }

    const data = await toggleFormLock(id, locked);
    req.app.get("io")?.emit("candidate:updated", data);

    return res.json({
      message: locked ? "Form locked" : "Form unlocked",
      data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: error.message || "Failed to update form lock",
    });
  }
}

// ── Individual unlock override ─────────────────────────────────────────────

export async function individualUnlockCandidate(req, res) {
  try {
    const { id } = req.params;
    const { unlocked } = req.body;

    if (typeof unlocked !== "boolean") {
      return res.status(400).json({ message: "`unlocked` must be a boolean" });
    }

    const data = await setIndividualUnlock(id, unlocked);
    req.app.get("io")?.emit("candidate:updated", data);

    return res.json({
      message: unlocked
        ? "Candidate individually unlocked (global lock override)"
        : "Individual unlock override removed",
      data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: error.message || "Failed to update individual unlock",
    });
  }
}

// ── Global form lock ───────────────────────────────────────────────────────

export async function getGlobalLockStatus(req, res) {
  try {
    const locked = await getGlobalLock();
    return res.json({ locked });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Failed to get global lock status" });
  }
}

export async function setGlobalLockStatus(req, res) {
  try {
    const { locked } = req.body;

    if (typeof locked !== "boolean") {
      return res.status(400).json({ message: "`locked` must be a boolean" });
    }

    await setGlobalLock(locked);
    req.app.get("io")?.emit("global:lock", { locked });

    return res.json({
      message: locked
        ? "Global form lock enabled"
        : "Global form lock disabled",
      locked,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update global lock" });
  }
}

export async function updateOwnDetails(req, res) {
  try {
    const token = bearerToken(req);
    if (!token)
      return res.status(401).json({ message: "Missing access token." });

    const user = await userFromToken(token);
    if (!user)
      return res.status(401).json({ message: "Invalid or expired session." });

    const data = await updateCandidateDetails(user.id, req.body);
    req.app.get("io")?.emit("candidate:updated", data);

    return res.json({
      message: "Details updated successfully.",
      profile: data,
    });
  } catch (error) {
    console.error(error);
    const status = error.message?.includes("locked") ? 403 : 400;
    return res
      .status(status)
      .json({ message: error.message || "Failed to update details." });
  }
}

export async function distributeSlotHandler(req, res) {
  try {
    const result = await distributeSlots();
    req.app.get("io")?.emit("slots:distributed", result);
    return res.json({ message: "Slots distributed successfully.", ...result });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to distribute slots." });
  }
}

export async function getSlotSummaryHandler(req, res) {
  try {
    const summary = await getSlotSummary();
    return res.json(summary);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to fetch slot summary." });
  }
}

export async function clearSlotsHandler(req, res) {
  try {
    await clearSlots();
    req.app.get("io")?.emit("slots:cleared");
    return res.json({ message: "All slots cleared." });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to clear slots." });
  }
}

// ── Slot Schedules ─────────────────────────────────────────────────────────────

export async function getSlotSchedulesHandler(req, res) {
  try {
    const schedules = await getSlotSchedules();
    return res.json(schedules);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to fetch slot schedules." });
  }
}

export async function setDayDateHandler(req, res) {
  try {
    const dayNumber = Number(req.params.day);
    if (!dayNumber || dayNumber < 1) {
      return res
        .status(400)
        .json({ message: "day must be a positive integer" });
    }

    const { slot_date } = req.body;
    const result = await setDayDate(dayNumber, slot_date || null);
    req.app
      .get("io")
      ?.emit("slots:schedules_updated", { type: "day", ...result });
    return res.json({ message: "Day date updated.", ...result });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to update day date." });
  }
}

export async function setSlotTimeHandler(req, res) {
  try {
    const slotNumber = Number(req.params.slot);
    if (!slotNumber || slotNumber < 1) {
      return res
        .status(400)
        .json({ message: "slot must be a positive integer" });
    }

    const { start_time } = req.body;
    const result = await setSlotTime(slotNumber, start_time || null);
    req.app
      .get("io")
      ?.emit("slots:schedules_updated", { type: "time", ...result });
    return res.json({ message: "Slot time updated.", ...result });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to update slot time." });
  }
}

export async function addDayHandler(req, res) {
  try {
    const { day_number } = req.body;
    const dayNumber = Number(day_number);
    if (!dayNumber || dayNumber < 1) {
      return res
        .status(400)
        .json({ message: "day_number must be a positive integer" });
    }
    const result = await addDayToSchedule(dayNumber);
    req.app
      .get("io")
      ?.emit("slots:schedules_updated", { type: "day_added", dayNumber });
    return res.json({ message: "Day added.", ...result });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to add day." });
  }
}

export async function removeDayHandler(req, res) {
  try {
    const dayNumber = Number(req.params.day);
    if (!dayNumber || dayNumber < 1) {
      return res
        .status(400)
        .json({ message: "day must be a positive integer" });
    }
    await removeDayFromSchedule(dayNumber);
    req.app
      .get("io")
      ?.emit("slots:schedules_updated", { type: "day_removed", dayNumber });
    return res.json({ message: "Day removed." });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to remove day." });
  }
}

export async function addSlotHandler(req, res) {
  try {
    const { slot_number } = req.body;
    const slotNumber = Number(slot_number);
    if (!slotNumber || slotNumber < 1) {
      return res
        .status(400)
        .json({ message: "slot_number must be a positive integer" });
    }
    const result = await addSlotToSchedule(slotNumber);
    req.app
      .get("io")
      ?.emit("slots:schedules_updated", { type: "slot_added", slotNumber });
    return res.json({ message: "Slot added.", ...result });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to add slot." });
  }
}

export async function removeSlotHandler(req, res) {
  try {
    const slotNumber = Number(req.params.slot);
    if (!slotNumber || slotNumber < 1) {
      return res
        .status(400)
        .json({ message: "slot must be a positive integer" });
    }
    await removeSlotFromSchedule(slotNumber);
    req.app
      .get("io")
      ?.emit("slots:schedules_updated", { type: "slot_removed", slotNumber });
    return res.json({ message: "Slot removed." });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to remove slot." });
  }
}