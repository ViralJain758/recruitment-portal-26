const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
).replace(/\/$/, "");

async function request(path, options = {}) {
  const { headers, ...requestOptions } = options;

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...requestOptions,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

export function signup(payload) {
  return request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function refreshSession(payload) {
  return request("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveCandidateDetails(payload, token) {
  return request("/api/auth/candidate-details", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function updateCandidateDetails(payload, token) {
  return request("/api/admin/candidate-details", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function getCandidates() {
  return request("/api/admin/candidates");
}

export function updateCandidateStatus(id, status) {
  return request(`/api/admin/candidates/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function updateCandidateAttendance(id, present) {
  return request(`/api/admin/candidates/${id}/attendance`, {
    method: "PATCH",
    body: JSON.stringify({ present }),
  });
}

export function lockCandidateForm(id, locked) {
  return request(`/api/admin/candidates/${id}/lock`, {
    method: "PATCH",
    body: JSON.stringify({ locked }),
  });
}

export function individualUnlockCandidateForm(id, unlocked) {
  return request(`/api/admin/candidates/${id}/individual-unlock`, {
    method: "PATCH",
    body: JSON.stringify({ unlocked }),
  });
}

export function deleteCandidate(id) {
  return request(`/api/admin/candidates/${id}`, {
    method: "DELETE",
  });
}

export function getGlobalLock() {
  return request("/api/admin/global-lock");
}

export function setGlobalLock(locked) {
  return request("/api/admin/global-lock", {
    method: "PATCH",
    body: JSON.stringify({ locked }),
  });
}

export async function getDashboard(signal) {
  const response = await fetch(`${apiBaseUrl}/dashboard`, { signal });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || "Failed to load dashboard.");
  }

  return text || "Dashboard";
}

export function markAttendance(qrToken) {
  return request("/api/admin/attendance", {
    method: "POST",
    body: JSON.stringify({ qrToken }),
  });
}

export function getAttendanceStats() {
  return request("/api/admin/attendance/stats");
}

// Slot distribution — admin only
export function distributeSlots() {
  return request("/api/admin/slots/distribute", { method: "POST" });
}

export function getSlotSummary() {
  return request("/api/admin/slots/summary");
}

export function clearAllSlots() {
  return request("/api/admin/slots", { method: "DELETE" });
}

// Slot schedules — admin only
export function getSlotSchedules() {
  return request("/api/admin/slots/schedules");
}

export function updateDayDate(dayNumber, slotDate) {
  return request(`/api/admin/slots/schedules/day/${dayNumber}`, {
    method: "PATCH",
    body: JSON.stringify({ slot_date: slotDate }),
  });
}

export function updateSlotTime(slotNumber, startTime) {
  return request(`/api/admin/slots/schedules/slot/${slotNumber}`, {
    method: "PATCH",
    body: JSON.stringify({ start_time: startTime }),
  });
}

export function addDay(dayNumber) {
  return request("/api/admin/slots/schedules/day", {
    method: "POST",
    body: JSON.stringify({ day_number: dayNumber }),
  });
}

export function removeDay(dayNumber) {
  return request(`/api/admin/slots/schedules/day/${dayNumber}`, {
    method: "DELETE",
  });
}

export function addSlot(slotNumber) {
  return request("/api/admin/slots/schedules/slot", {
    method: "POST",
    body: JSON.stringify({ slot_number: slotNumber }),
  });
}

export function removeSlot(slotNumber) {
  return request(`/api/admin/slots/schedules/slot/${slotNumber}`, {
    method: "DELETE",
  });
}
