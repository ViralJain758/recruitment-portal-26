import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import hpp from "hpp";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { verifyAdminSession, getUserByToken } from "./src/models/authModel.js";
import { findCandidateByUserId } from "./src/models/candidateModel.js";
import db from "./src/config/db.js";
import authRoutes from "./src/routes/authRoute.js";
import adminRoutes from "./src/routes/adminRoute.js";
import dashboardRoutes from "./src/routes/dashboardRoute.js";
import otpRoutes from "./src/routes/otpRoute.js";
import quizRoutes from "./src/routes/quizRoute.js";
import { ensureQuizQuestionsTable } from "./src/services/quizService.js";
import { ensureEmailVerificationsTable } from "./src/models/otpModel.js";
import logger from "./src/config/logger.js";
import validateEnv from "./src/config/validateEnv.js";
import httpsEnforce from "./src/middleware/httpsEnforce.js";
import requestLogger from "./src/middleware/requestLogger.js";
import { logRateLimitExceeded } from "./src/middleware/securityEvents.js";
import { burstLimiter, isLoadTestBypassRequest } from "./src/middleware/rateLimiters.js";
import redisConnection from "./src/config/redis.js";
import { quizSubmitQueue, quizSubmitQueueEvents } from "./src/queues/quizSubmitQueue.js";
import { quizSubmitWorker } from "./src/workers/quizSubmitWorker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

// Fail fast if secrets are missing/placeholder/too-short instead of
// serving traffic with an insecure configuration.
validateEnv();

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 5000;

// The app is deployed behind a reverse proxy / load balancer (Render,
// Railway, Fly.io, an ALB, etc.) that terminates TLS. Trusting the first
// proxy hop lets Express correctly read `req.ip` and `req.secure` from the
// standard `X-Forwarded-*` headers instead of always seeing the proxy's own
// address/protocol — this matters for rate limiting, audit logs, and HTTPS
// enforcement below. Adjust the hop count if additional proxies sit in front.
app.set("trust proxy", 1);
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
  // Allow any localhost origin during development (different dev ports)
  if (
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1")
  )
    return true;
  return allowedOrigins.includes(origin);
}

const io = new Server(httpServer, {
  cors: {
    // FIX: this used to be a static `allowedOrigins` array, which silently
    // rejected the handshake from any dev port other than 5173/5174 (Vite
    // auto-increments the port if one is busy) even though the *same*
    // origin sailed straight through the regular Express `cors()` below.
    // That mismatch is why sockets could appear "completely broken" in dev
    // while the REST API kept working fine. Reuse the same origin check the
    // HTTP layer uses so both stay in sync.
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  },
});

app.set("io", io);

// ── Socket auth ──────────────────────────────────────────────────────────
// Two kinds of sockets connect here:
//   - Admin dashboards, authenticated via the httpOnly `adminSession`
//     cookie, get the full live feed of every candidate change.
//   - Candidate browser tabs, authenticated via their JWT access token
//     (sent as `auth.token` on the client, since candidates don't have an
//     httpOnly session cookie), only ever get updates about *themselves*
//     and the slot they're assigned to.
// Anyone who doesn't present valid credentials for one of these is
// rejected at the handshake — no anonymous listeners.
function parseCookieHeader(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  });
  return out;
}

io.use(async (socket, next) => {
  const cookies = parseCookieHeader(socket.request.headers.cookie);
  const admin = cookies.adminSession
    ? verifyAdminSession(cookies.adminSession)
    : null;

  if (admin) {
    socket.data.role = "admin";
    socket.data.admin = admin;
    return next();
  }

  const token = socket.handshake.auth?.token;
  if (token) {
    const { data } = await getUserByToken(token);
    if (data?.user) {
      socket.data.role = "candidate";
      socket.data.userId = data.user.id;
      return next();
    }
  }

  return next(new Error("Unauthorized"));
});

// Looks up the candidate's current slot and makes sure their socket is (and
// only is) in that slot's room — leaving whatever slot room it was in
// before. Called on connect and whenever the client asks for a resync
// (e.g. after their slot assignment might have changed).
async function syncCandidateSlotRoom(socket) {
  const { data } = await findCandidateByUserId(socket.data.userId);
  for (const room of socket.rooms) {
    if (room.startsWith("slot:")) socket.leave(room);
  }
  if (data?.slot_id) {
    socket.join(`slot:${data.slot_id}`);
  }
}

io.on("connection", (socket) => {
  if (socket.data.role === "admin") {
    socket.join("admin");
    logger.info("Admin socket connected", { socketId: socket.id });
    socket.on("disconnect", (reason) => {
      logger.info("Admin socket disconnected", {
        socketId: socket.id,
        reason,
      });
    });
    return;
  }

  // Candidate socket
  socket.join(`candidate:${socket.data.userId}`);
  socket.join("candidates");
  syncCandidateSlotRoom(socket).catch((error) => {
    logger.error("Failed to sync candidate slot room", {
      error: error.message,
      userId: socket.data.userId,
    });
  });

  socket.on("slot:refresh", () => {
    syncCandidateSlotRoom(socket).catch((error) => {
      logger.error("Failed to refresh candidate slot room", {
        error: error.message,
        userId: socket.data.userId,
      });
    });
  });

  logger.info("Candidate socket connected", {
    socketId: socket.id,
    userId: socket.data.userId,
  });
  socket.on("disconnect", (reason) => {
    logger.info("Candidate socket disconnected", {
      socketId: socket.id,
      userId: socket.data.userId,
      reason,
    });
  });
});

// Redirect any plain-HTTP request to HTTPS before anything else runs.
app.use(httpsEnforce);

// Assigns a request id and logs every request/response (method, path,
// status, latency, ip, user agent) — this is the base layer that "API
// errors" and "unusual traffic" logging build on. It must run early so the
// request id is available to every downstream handler and error logger.
app.use(requestLogger);

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      logger.warn("Rejected cross-origin request", { origin });
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
    // Tell browsers to only ever talk to this origin over HTTPS, including
    // subdomains, for a year — standard HSTS hardening once HTTPS is
    // confirmed to work end-to-end. Only meaningful (and only sent) once
    // the app is actually served over HTTPS in production.
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: isLoadTestBypassRequest,
    handler: (req, res, _next, options) => {
      logRateLimitExceeded(req, "global");
      res.status(options.statusCode).json(options.message);
    },
  }),
);

// Short-window burst guard layered on top of the 15-minute limiter above.
// The long window only trips after sustained abuse; this one catches a
// script firing requests as fast as it can, within seconds, well before
// that. Skips /health so uptime monitors polling every few seconds never
// get caught in it.
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  return burstLimiter(req, res, next);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/dashboard", dashboardRoutes);

app.use((err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  (req.log || logger).error("Unhandled request error", {
    error: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });
  res.status(statusCode).json({
    message:
      statusCode >= 500
        ? "Internal server error"
        : err.message || "Internal server error",
    requestId: req.requestId,
  });
});

// Catch anything that slips past request-scoped handling so it's never
// silently lost — these indicate bugs, not user error, and should be
// investigated.
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", {
    error: error.message,
    stack: error.stack,
  });
});

async function ensureBaseSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT    NOT NULL UNIQUE,
      password   TEXT    NOT NULL,
      role       TEXT    NOT NULL DEFAULT 'user',
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT    NOT NULL UNIQUE,
      token_hash TEXT    UNIQUE,
      expires_at TEXT    NOT NULL,
      revoked    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS candidate_profiles (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id            INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      email              TEXT    NOT NULL UNIQUE,
      application_number TEXT    NOT NULL,
      full_name          TEXT    NOT NULL,
      date_of_birth      TEXT    NOT NULL,
      created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS candidate_form (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id         INTEGER NOT NULL UNIQUE REFERENCES candidate_profiles(id) ON DELETE CASCADE,
      attendance           TEXT    NOT NULL,
      join_reason          TEXT    NOT NULL,
      primary_department   TEXT    NOT NULL,
      secondary_department TEXT    NOT NULL,
      other_societies      TEXT    NOT NULL,
      recruit_reason       TEXT    NOT NULL,
      updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS slot_day_dates (
      day_number INTEGER PRIMARY KEY,
      slot_date  TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS slot_time_schedules (
      slot_number INTEGER PRIMARY KEY,
      start_time  TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS slots (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_day    INTEGER NOT NULL,
      slot_number INTEGER NOT NULL,
      slot_venue  TEXT    NOT NULL,
      is_active   INTEGER NOT NULL DEFAULT 0,
      UNIQUE (slot_day, slot_number, slot_venue)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS candidate_status (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id       INTEGER NOT NULL UNIQUE REFERENCES candidate_profiles(id) ON DELETE CASCADE,
      application_status TEXT,
      form_locked        INTEGER NOT NULL DEFAULT 0,
      individual_unlock  INTEGER NOT NULL DEFAULT 0,
      slot_id            INTEGER REFERENCES slots(id) ON DELETE SET NULL,
      updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS candidate_quiz (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id     INTEGER NOT NULL UNIQUE REFERENCES candidate_profiles(id) ON DELETE CASCADE,
      qr_token         TEXT    NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),
      quiz_attended    INTEGER NOT NULL DEFAULT 0,
      quiz_attended_at TEXT,
      quiz_score       INTEGER,
      quiz_submitted_at TEXT,
      quiz_attempt_count INTEGER NOT NULL DEFAULT 0,
      updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  async function ensureColumn(tableName, columnName, definition) {
    const infoResult = await db.execute(`PRAGMA table_info(${tableName})`);
    const exists = infoResult.rows.some((row) => row.name === columnName);
    if (!exists) {
      await db.execute(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
    }
  }

  await ensureColumn(
    "users",
    "email_verified",
    "email_verified INTEGER NOT NULL DEFAULT 1",
  );
  await ensureColumn(
    "users",
    "failed_login_attempts",
    "failed_login_attempts INTEGER NOT NULL DEFAULT 0",
  );
  await ensureColumn("users", "locked_until", "locked_until TEXT");
  await ensureColumn("refresh_tokens", "token_hash", "token_hash TEXT");
  await ensureColumn("candidate_quiz", "quiz_score", "quiz_score INTEGER");
  await ensureColumn(
    "candidate_quiz",
    "quiz_submitted_at",
    "quiz_submitted_at TEXT",
  );
  await ensureColumn(
    "candidate_quiz",
    "quiz_attempt_count",
    "quiz_attempt_count INTEGER NOT NULL DEFAULT 0",
  );

  await db.execute(`
    CREATE TABLE IF NOT EXISTS pending_users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      expires_at    TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at    TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `);

  await db.execute(
    "INSERT INTO app_settings (key, value) VALUES ('global_form_locked', 'false') ON CONFLICT (key) DO NOTHING",
  );

  await db.execute(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id          TEXT UNIQUE,
      section              TEXT NOT NULL DEFAULT 'General',
      question_text        TEXT NOT NULL,
      image_url            TEXT,
      options_json         TEXT NOT NULL,
      correct_answer_index INTEGER NOT NULL,
      display_order        INTEGER NOT NULL DEFAULT 0,
      is_active            INTEGER NOT NULL DEFAULT 1,
      created_at           TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS quiz_papers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_date   TEXT    NOT NULL,
      start_time  TEXT    NOT NULL,
      slot_day    INTEGER,
      slot_number INTEGER,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(slot_date, start_time)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS quiz_paper_questions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id       INTEGER NOT NULL REFERENCES quiz_papers(id) ON DELETE CASCADE,
      question_id    INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
      question_order INTEGER NOT NULL,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(paper_id, question_id),
      UNIQUE(paper_id, question_order)
    )
  `);

  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON candidate_profiles(user_id)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidate_profiles(email)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_candidate_form_cid ON candidate_form(candidate_id)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_candidate_status_cid ON candidate_status(candidate_id)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_candidate_status_slot ON candidate_status(slot_id)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_candidate_quiz_cid ON candidate_quiz(candidate_id)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_candidate_quiz_qrtoken ON candidate_quiz(qr_token)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_pending_users_email ON pending_users(email)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_slots_day_number ON slots(slot_day, slot_number)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_quiz_questions_active_order ON quiz_questions(is_active, display_order, id)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_quiz_papers_schedule ON quiz_papers(slot_date, start_time)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_quiz_paper_questions_paper ON quiz_paper_questions(paper_id, question_order)",
  );
}

async function ensureSlotActivationColumn() {
  const result = await db.execute("PRAGMA table_info(slots)");
  const hasIsActive = result.rows.some((row) => row.name === "is_active");

  if (!hasIsActive) {
    await db.execute(
      "ALTER TABLE slots ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0",
    );
  }
}

async function ensureSlotSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS slot_day_dates (
      day_number INTEGER PRIMARY KEY,
      slot_date  TEXT
    )
  `);

  await db.execute(
    `
    CREATE TABLE IF NOT EXISTS slot_time_schedules (
      slot_number INTEGER PRIMARY KEY,
      start_time  TEXT
    )
  `,
  );

  await db.execute(`
    CREATE TABLE IF NOT EXISTS slots (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_day    INTEGER NOT NULL,
      slot_number INTEGER NOT NULL,
      slot_venue  TEXT    NOT NULL,
      is_active   INTEGER NOT NULL DEFAULT 0,
      UNIQUE (slot_day, slot_number, slot_venue)
    )
  `);

  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_slots_day_number ON slots(slot_day, slot_number)",
  );
}

await ensureBaseSchema();
await ensureSlotSchema();
await ensureSlotActivationColumn();
await ensureEmailVerificationsTable();
await ensureQuizQuestionsTable();

httpServer.listen(port, 2048, () => {
  logger.info("Server started", {
    port,
    environment: process.env.NODE_ENV || "development",
  });
  logger.info("Quiz submit worker started", {
    concurrency: process.env.QUIZ_SUBMIT_CONCURRENCY || "50",
  });
});

// Drain in-flight quiz submissions and close Redis connections cleanly on
// shutdown instead of dropping jobs mid-write. `worker.close()` waits for
// whatever the worker is currently processing to finish first.
async function shutdown(signal) {
  logger.info("Shutting down", { signal });
  try {
    await quizSubmitWorker.close();
    await quizSubmitQueueEvents.close();
    await quizSubmitQueue.close();
    await redisConnection.quit();
  } catch (error) {
    logger.error("Error during shutdown", { error: error.message });
  } finally {
    httpServer.close(() => process.exit(0));
    // Force-exit if connections (sockets, etc.) don't close in time.
    setTimeout(() => process.exit(0), 10000).unref();
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
