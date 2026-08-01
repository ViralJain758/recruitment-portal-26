import { io } from "socket.io-client";

const socketUrl = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
).replace(/\/$/, "");

export const adminSocket = io(socketUrl, {
  autoConnect: false,
  withCredentials: true,
});
