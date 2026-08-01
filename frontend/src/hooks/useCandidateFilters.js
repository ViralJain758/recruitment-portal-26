import { useMemo, useState } from "react";

const DEPT_ORDER = ["Tech", "Design", "Marketing", "Content", "Media"];

function getSlotSortValue(candidate) {
  if (!candidate?.slot_id) return Number.MAX_SAFE_INTEGER;
  return Number(candidate.slot_id);
}

export function useCandidateFilters(candidates) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [deptSort, setDeptSort] = useState("All");
  const [slotSort, setSlotSort] = useState("All");

  const filteredCandidates = useMemo(() => {
    const filtered = candidates.filter((candidate) => {
      const matchesSearch = `${candidate.full_name}
        ${candidate.email}
        ${candidate.application_number}`
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || candidate.application_status === statusFilter;

      const matchesDept =
        deptSort === "All" ||
        candidate.primary_department === deptSort ||
        candidate.secondary_department === deptSort;

      const matchesSlot = slotSort === "All" ||
        (slotSort === "Assigned" ? Boolean(candidate.slot_id) : !candidate.slot_id);

      return matchesSearch && matchesStatus && matchesDept && matchesSlot;
    });

    if (slotSort !== "All") {
      filtered.sort((a, b) => {
        const aAssigned = Boolean(a.slot_id);
        const bAssigned = Boolean(b.slot_id);
        if (aAssigned !== bAssigned) return aAssigned ? -1 : 1;
        return getSlotSortValue(a) - getSlotSortValue(b);
      });
    } else if (deptSort === "All") {
      filtered.sort((a, b) => {
        const ai = DEPT_ORDER.indexOf(a.primary_department);
        const bi = DEPT_ORDER.indexOf(b.primary_department);
        const deptDiff = (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        if (deptDiff !== 0) return deptDiff;
        return (a.full_name ?? "").localeCompare(b.full_name ?? "");
      });
    } else {
      filtered.sort((a, b) => {
        const aPrimary = a.primary_department === deptSort ? 0 : 1;
        const bPrimary = b.primary_department === deptSort ? 0 : 1;
        if (aPrimary !== bPrimary) return aPrimary - bPrimary;
        return (a.full_name ?? "").localeCompare(b.full_name ?? "");
      });
    }

    return filtered;
  }, [candidates, search, statusFilter, deptSort, slotSort]);

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    deptSort,
    setDeptSort,
    slotSort,
    setSlotSort,
    filteredCandidates,
  };
}
