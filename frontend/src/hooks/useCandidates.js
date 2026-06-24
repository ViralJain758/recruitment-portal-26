import { useEffect, useState } from "react";
import {
  getCandidates,
  updateCandidateStatus,
  updateCandidateAttendance,
  deleteCandidate,
  lockCandidateForm,
  individualUnlockCandidateForm,
  getGlobalLock,
  setGlobalLock,
  distributeSlots,
  getSlotSummary,
  clearAllSlots,
  getSlotSchedules,
  updateDayDate,
  updateSlotTime,
  addDay,
  removeDay,
  addSlot,
  removeSlot,
} from "../lib/api";

import { adminSocket } from "../lib/socket";
import { upsertCandidate } from "../utils/candidateHelpers";

export function useCandidates() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalLocked, setGlobalLocked] = useState(false);
  const [globalLockLoading, setGlobalLockLoading] = useState(false);
  const [slotSummary, setSlotSummary] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);

  // schedules: { days: [{day_number, slot_date}], times: [{slot_number, start_time}] }
  const [slotSchedules, setSlotSchedules] = useState({ days: [], times: [] });
  const [schedulesLoading, setSchedulesLoading] = useState(false);

  async function fetchCandidates() {
    try {
      setLoading(true);
      const data = await getCandidates();
      setCandidates(data);
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to load candidates.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchGlobalLock() {
    try {
      const response = await getGlobalLock();
      setGlobalLocked(response.locked);
    } catch (error) {
      console.error("Failed to fetch global lock status:", error);
    }
  }

  async function toggleGlobalLock(locked) {
    setGlobalLockLoading(true);
    try {
      const response = await setGlobalLock(locked);
      setGlobalLocked(response.locked);
      return response.locked;
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to update global lock.");
      return null;
    } finally {
      setGlobalLockLoading(false);
    }
  }

  async function updateStatus(id, status) {
    try {
      const response = await updateCandidateStatus(id, status);
      const updatedCandidate = response.data;
      setCandidates((current) => upsertCandidate(current, updatedCandidate));
      return updatedCandidate;
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to update status.");
      return null;
    }
  }

  async function updateAttendance(id, present) {
    try {
      const response = await updateCandidateAttendance(id, present);
      const updatedCandidate = response.data;
      setCandidates((current) => upsertCandidate(current, updatedCandidate));
      return updatedCandidate;
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to update attendance.");
      return null;
    }
  }

  async function removeCandidate(id) {
    try {
      await deleteCandidate(id);
      setCandidates((current) => current.filter((c) => c.id !== id));
      return true;
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to delete candidate.");
      return false;
    }
  }

  async function toggleLock(id, locked) {
    try {
      const response = await lockCandidateForm(id, locked);
      const updatedCandidate = response.data;
      setCandidates((current) => upsertCandidate(current, updatedCandidate));
      return updatedCandidate;
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to update form lock.");
      return null;
    }
  }

  async function individualUnlock(id, unlocked) {
    try {
      const response = await individualUnlockCandidateForm(id, unlocked);
      const updatedCandidate = response.data;
      setCandidates((current) => upsertCandidate(current, updatedCandidate));
      return updatedCandidate;
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to update individual unlock.");
      return null;
    }
  }

  async function fetchSlotSummary() {
    try {
      const data = await getSlotSummary();
      setSlotSummary(data);
    } catch (error) {
      console.error("Failed to fetch slot summary:", error);
    }
  }

  async function fetchSlotSchedules() {
    try {
      const data = await getSlotSchedules();
      setSlotSchedules(data);
    } catch (error) {
      console.error("Failed to fetch slot schedules:", error);
    }
  }

  async function runDistributeSlots() {
    setSlotLoading(true);
    try {
      const result = await distributeSlots();
      await fetchCandidates();
      await fetchSlotSummary();
      return result;
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to distribute slots.");
      return null;
    } finally {
      setSlotLoading(false);
    }
  }

  async function runClearSlots() {
    setSlotLoading(true);
    try {
      await clearAllSlots();
      await fetchCandidates();
      setSlotSummary([]);
      return true;
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to clear slots.");
      return false;
    } finally {
      setSlotLoading(false);
    }
  }

  async function saveDayDate(dayNumber, slotDate) {
    setSchedulesLoading(true);
    try {
      await updateDayDate(dayNumber, slotDate);
      setSlotSchedules((prev) => ({
        ...prev,
        days: prev.days.map((d) =>
          d.day_number === dayNumber
            ? { ...d, slot_date: slotDate || null }
            : d,
        ),
      }));
      return true;
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to update day date.");
      return false;
    } finally {
      setSchedulesLoading(false);
    }
  }

  async function saveSlotTime(slotNumber, startTime) {
    setSchedulesLoading(true);
    try {
      await updateSlotTime(slotNumber, startTime);
      setSlotSchedules((prev) => ({
        ...prev,
        times: prev.times.map((t) =>
          t.slot_number === slotNumber
            ? { ...t, start_time: startTime || null }
            : t,
        ),
      }));
      return true;
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to update slot time.");
      return false;
    } finally {
      setSchedulesLoading(false);
    }
  }

  async function addDayFn(dayNumber) {
    setSchedulesLoading(true);
    try {
      await addDay(dayNumber);
      await fetchSlotSchedules();
      await fetchSlotSummary();
      return true;
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to add day.");
      return false;
    } finally {
      setSchedulesLoading(false);
    }
  }

  async function removeDayFn(dayNumber) {
    setSchedulesLoading(true);
    try {
      await removeDay(dayNumber);
      await fetchSlotSchedules();
      await fetchSlotSummary();
      await fetchCandidates();
      return true;
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to remove day.");
      return false;
    } finally {
      setSchedulesLoading(false);
    }
  }

  async function addSlotFn(slotNumber) {
    setSchedulesLoading(true);
    try {
      await addSlot(slotNumber);
      await fetchSlotSchedules();
      await fetchSlotSummary();
      return true;
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to add slot.");
      return false;
    } finally {
      setSchedulesLoading(false);
    }
  }

  async function removeSlotFn(slotNumber) {
    setSchedulesLoading(true);
    try {
      await removeSlot(slotNumber);
      await fetchSlotSchedules();
      await fetchSlotSummary();
      await fetchCandidates();
      return true;
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to remove slot.");
      return false;
    } finally {
      setSchedulesLoading(false);
    }
  }

  useEffect(() => {
    fetchCandidates();
    fetchGlobalLock();
    fetchSlotSummary();
    fetchSlotSchedules();
  }, []);

  useEffect(() => {
    function handleCandidateChange(candidate) {
      setCandidates((current) => upsertCandidate(current, candidate));
    }

    function handleCandidateDeleted({ id }) {
      setCandidates((current) => current.filter((c) => c.id !== id));
    }

    function handleGlobalLock({ locked }) {
      setGlobalLocked(locked);
    }

    function handleSlotsDistributed() {
      fetchCandidates();
      fetchSlotSummary();
    }

    function handleSlotsCleared() {
      fetchCandidates();
      setSlotSummary([]);
    }

    function handleSchedulesUpdated() {
      fetchSlotSchedules();
    }

    adminSocket.on("candidate:submitted", handleCandidateChange);
    adminSocket.on("candidate:updated", handleCandidateChange);
    adminSocket.on("candidate:deleted", handleCandidateDeleted);
    adminSocket.on("global:lock", handleGlobalLock);
    adminSocket.on("slots:distributed", handleSlotsDistributed);
    adminSocket.on("slots:cleared", handleSlotsCleared);
    adminSocket.on("slots:schedules_updated", handleSchedulesUpdated);
    adminSocket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });
    adminSocket.connect();

    return () => {
      adminSocket.off("candidate:submitted", handleCandidateChange);
      adminSocket.off("candidate:updated", handleCandidateChange);
      adminSocket.off("candidate:deleted", handleCandidateDeleted);
      adminSocket.off("global:lock", handleGlobalLock);
      adminSocket.off("slots:distributed", handleSlotsDistributed);
      adminSocket.off("slots:cleared", handleSlotsCleared);
      adminSocket.off("slots:schedules_updated", handleSchedulesUpdated);
      adminSocket.disconnect();
    };
  }, []);

  return {
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
    addDay: addDayFn,
    removeDay: removeDayFn,
    addSlot: addSlotFn,
    removeSlot: removeSlotFn,
  };
}
