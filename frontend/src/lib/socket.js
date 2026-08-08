import { io } from "socket.io-client";

const socketUrl = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
).replace(/\/$/, "");

export const adminSocket = io(socketUrl, {
  autoConnect: false,
  withCredentials: true,
});

// Candidates don't have an httpOnly session cookie the socket handshake can
// read, so auth is done differently: the caller sets `.auth = { token }`
// with the candidate's JWT access token before calling `.connect()` (see
// useCandidateSocket). withCredentials isn't needed here since no cookie is
// involved.
export const candidateSocket = io(socketUrl, {
  autoConnect: false,
});
