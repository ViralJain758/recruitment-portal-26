import { useEffect } from "react";
import { candidateSocket } from "../lib/socket";

// Connects the candidate's own live-update socket. This mirrors the admin
// dashboard's `adminSocket`, but scoped to a single candidate: the server
// only ever sends this socket events about the candidate's own record and
// the slot they're assigned to.
//
// Callbacks:
//   onCandidateUpdated(data)  - the candidate's own row changed (status,
//                               attendance, lock, slot assignment, etc.)
//   onSlotActivated({ slot }) - the candidate's currently-assigned slot was
//                               just switched on by an admin
//   onSlotDeactivated({ slot })
//   onSelfRefresh()           - a bulk operation happened (slots distributed
//                               / cleared) with no per-candidate diff to
//                               send; caller should re-fetch its own profile
export function useCandidateSocket({
  accessToken,
  onCandidateUpdated,
  onSlotActivated,
  onSlotDeactivated,
  onSelfRefresh,
}) {
  useEffect(() => {
    if (!accessToken) return undefined;

    candidateSocket.auth = { token: accessToken };

    function handleCandidateUpdated(data) {
      onCandidateUpdated?.(data);
      // Their slot assignment may have just changed as part of this update
      // — make sure the socket's room membership reflects it.
      candidateSocket.emit("slot:refresh");
    }

    function handleSlotActivated(payload) {
      onSlotActivated?.(payload);
    }

    function handleSlotDeactivated(payload) {
      onSlotDeactivated?.(payload);
    }

    function handleSelfRefresh() {
      onSelfRefresh?.();
      candidateSocket.emit("slot:refresh");
    }

    function handleConnect() {
      candidateSocket.emit("slot:refresh");
    }

    function handleConnectError(err) {
      console.error("Candidate socket connection error:", err.message);
    }

    candidateSocket.on("connect", handleConnect);
    candidateSocket.on("candidate:updated", handleCandidateUpdated);
    candidateSocket.on("slot:activated", handleSlotActivated);
    candidateSocket.on("slot:deactivated", handleSlotDeactivated);
    candidateSocket.on("candidate:self_refresh", handleSelfRefresh);
    candidateSocket.on("connect_error", handleConnectError);

    candidateSocket.connect();

    return () => {
      candidateSocket.off("connect", handleConnect);
      candidateSocket.off("candidate:updated", handleCandidateUpdated);
      candidateSocket.off("slot:activated", handleSlotActivated);
      candidateSocket.off("slot:deactivated", handleSlotDeactivated);
      candidateSocket.off("candidate:self_refresh", handleSelfRefresh);
      candidateSocket.off("connect_error", handleConnectError);
      candidateSocket.disconnect();
    };
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps
}
