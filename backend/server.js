import express from "express";
import { createServer } from "node:http";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import hpp from "hpp";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import authRoutes from "./src/routes/authRoute.js";
import adminRoutes from "./src/routes/adminRoute.js";
import dashboardRoutes from "./src/routes/dashboardRoute.js";
import otpRoutes from "./src/routes/otpRoute.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 5000;
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const io = new Server(httpServer, {
  cors: {
    origin: clientOrigin,
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${socket.id} — ${reason}`);
  });
});

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(hpp());
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/admin", adminRoutes);
app.use("/dashboard", dashboardRoutes);

app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || "Internal server error",
  });
});

httpServer.listen(port, () => {
  console.log(`Auth server running on port ${port}`);
});

export default app;
