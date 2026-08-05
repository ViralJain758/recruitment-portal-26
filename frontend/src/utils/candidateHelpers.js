export function upsertCandidate(candidates, incomingCandidate) {
  const existingIndex = candidates.findIndex(
    (candidate) => candidate.id === incomingCandidate.id,
  );

  if (existingIndex === -1) {
    return [incomingCandidate, ...candidates];
  }

  return candidates.map((candidate) =>
    candidate.id === incomingCandidate.id ? incomingCandidate : candidate,
  );
}

function normalizeStatus(status) {
  return typeof status === "string" ? status.trim().toLowerCase() : "";
}

export function getStatusGroup(status) {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === "shortlisted") return "shortlisted";
  if (normalizedStatus === "rejected") return "rejected";
  return "pending";
}

export function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    return trimmed === "1" || trimmed === "true" || trimmed === "yes";
  }
  return false;
}

export function calculateStats(candidates) {
  return {
    total: candidates.length,

    pending: candidates.filter((candidate) => getStatusGroup(candidate.application_status) === "pending").length,

    shortlisted: candidates.filter((candidate) => getStatusGroup(candidate.application_status) === "shortlisted").length,

    rejected: candidates.filter((candidate) => getStatusGroup(candidate.application_status) === "rejected").length,
  };
}
