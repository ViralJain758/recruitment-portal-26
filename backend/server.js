import express from "express";
import { createServer } from "node:http";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import hpp from "hpp";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import db from "./src/config/db.js";
import authRoutes from "./src/routes/authRoute.js";
import adminRoutes from "./src/routes/adminRoute.js";
import dashboardRoutes from "./src/routes/dashboardRoute.js";
import otpRoutes from "./src/routes/otpRoute.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 5000;
const configuredOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  ...configuredOrigins,
];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
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
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed: ${origin}`));
    },
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

async function ensureSlotActivationColumn() {
  const result = await db.execute("PRAGMA table_info(slots)");
  const hasIsActive = result.rows.some((row) => row.name === "is_active");

  if (!hasIsActive) {
    await db.execute(
      "ALTER TABLE slots ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0",
    );
  }
}

await ensureSlotActivationColumn();

httpServer.listen(port, () => {
  console.log(`Auth server running on port ${port}`);
});

export default app;
