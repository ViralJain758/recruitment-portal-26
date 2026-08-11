import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import db from "../config/db.js";

const ACCESS_TOKEN_EXPIRY = "15m";
const ADMIN_SESSION_EXPIRY = "3h";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const PENDING_SIGNUP_EXPIRY_MINUTES = 30;
const PASSWORD_RESET_EXPIRY_MINUTES = 30;
const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCKOUT_MINUTES = 15;

function signAccess(payload) {
  return jwt.sign(payload, requiredSecret("JWT_SECRET"), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

function signRefresh(payload) {
  return jwt.sign(payload, requiredSecret("JWT_REFRESH_SECRET"), {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

export function signAdminSession(payload) {
  return jwt.sign(
    { ...payload, role: "admin", type: "admin-session" },
    requiredSecret("JWT_SECRET"),
    { expiresIn: ADMIN_SESSION_EXPIRY },
  );
}

export function verifyAdminSession(token) {
  try {
    const payload = jwt.verify(token, requiredSecret("JWT_SECRET"));
    if (payload?.role !== "admin" || payload?.type !== "admin-session") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function signScannerSession() {
  return jwt.sign({ type: "scanner-session" }, requiredSecret("JWT_SECRET"), {
    expiresIn: "2h",
  });
}

export function verifyScannerSession(token) {
  try {
    const payload = jwt.verify(token, requiredSecret("JWT_SECRET"));
    return payload?.type === "scanner-session" ? payload : null;
  } catch {
    return null;
  }
}

export function verifyAccessTokenPayload(token) {
  try {
    const payload = jwt.verify(token, requiredSecret("JWT_SECRET"));
    if (!payload?.id || !payload?.email) return null;
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role || "user",
    };
  } catch {
    return null;
  }
}

function requiredSecret(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password, hash) {
  if (!password || !hash) return false;
  const expected = hash.trim();

  if (
    !expected.startsWith("$2a$") &&
    !expected.startsWith("$2b$") &&
    !expected.startsWith("$2y$")
  ) {
    const submittedBuffer = Buffer.from(String(password).trim(), "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    const length = Math.max(submittedBuffer.length, expectedBuffer.length);
    const paddedSubmitted = Buffer.alloc(length);
    const paddedExpected = Buffer.alloc(length);

    submittedBuffer.copy(paddedSubmitted);
    expectedBuffer.copy(paddedExpected);

    return (
      submittedBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(paddedSubmitted, paddedExpected)
    );
  }

  return bcrypt.compare(password, expected);
}

async function cleanupExpiredAuthRows() {
  const now = new Date().toISOString();
  await db.execute({
    sql: "DELETE FROM pending_users WHERE expires_at <= ?",
    args: [now],
  });
  await db.execute({
    sql: "DELETE FROM password_reset_tokens WHERE expires_at <= ?",
    args: [now],
  });
  await db.execute({
    sql: "UPDATE refresh_tokens SET revoked = 1 WHERE expires_at <= ? AND revoked = 0",
    args: [now],
  });
}

export async function createUser(email, password) {
  const hash = await hashPassword(password);
  return createUserWithPasswordHash(email, hash);
}

export async function createUserWithPasswordHash(email, passwordHash) {
  try {
    const result = await db.execute({
      sql: "INSERT INTO users (email, password, role, email_verified) VALUES (?, ?, 'user', 1)",
      args: [email, passwordHash],
    });
    const user = await db.execute({
      sql: "SELECT id, email, role FROM users WHERE id = ?",
      args: [Number(result.lastInsertRowid)],
    });
    return { data: { user: user.rows[0] }, error: null };
  } catch (err) {
    if (err.message?.includes("UNIQUE")) {
      return {
        data: null,
        error: { message: "A user with that email already exists." },
      };
    }
    return { data: null, error: { message: err.message } };
  }
}

export async function createSessionForUser(user) {
  const payload = { id: user.id, email: user.email, role: user.role };
  const accessToken = signAccess(payload);
  const refreshToken = signRefresh(payload);
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRY_MS,
  ).toISOString();

  await cleanupExpiredAuthRows();
  await db.execute({
    sql: "INSERT INTO refresh_tokens (user_id, token, token_hash, expires_at) VALUES (?, ?, ?, ?)",
    args: [
      user.id,
      tokenHash(refreshToken),
      tokenHash(refreshToken),
      expiresAt,
    ],
  });

  return {
    session: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + 15 * 60,
    },
    user: { id: user.id, email: user.email, role: user.role },
  };
}

export async function createPendingUser(email, password) {
  await cleanupExpiredAuthRows();
  const passwordHash = await hashPassword(password);
  const expiresAt = new Date(
    Date.now() + PENDING_SIGNUP_EXPIRY_MINUTES * 60 * 1000,
  ).toISOString();

  await db.execute({
    sql: "DELETE FROM pending_users WHERE email = ?",
    args: [email],
  });
  await db.execute({
    sql: "INSERT INTO pending_users (email, password_hash, expires_at) VALUES (?, ?, ?)",
    args: [email, passwordHash, expiresAt],
  });

  return { expiresAt };
}

export async function consumePendingUser(email) {
  await cleanupExpiredAuthRows();
  const result = await db.execute({
    sql: "SELECT id, password_hash, expires_at FROM pending_users WHERE email = ? ORDER BY created_at DESC LIMIT 1",
    args: [email],
  });
  const pending = result.rows[0];

  if (!pending || new Date(pending.expires_at) <= new Date()) {
    return {
      data: null,
      error: {
        message: "Signup verification has expired. Please sign up again.",
      },
    };
  }

  await db.execute({
    sql: "DELETE FROM pending_users WHERE email = ?",
    args: [email],
  });

  return { data: { passwordHash: pending.password_hash }, error: null };
}

export async function signIn(email, password) {
  const result = await db.execute({
    sql: "SELECT id, email, password, role, email_verified, failed_login_attempts, locked_until FROM users WHERE email = ?",
    args: [email],
  });

  const user = result.rows[0];

  // Always run a bcrypt comparison, even for unknown users, so that the
  // response time doesn't reveal whether the email exists (timing side channel).
  if (!user) {
    await comparePassword(
      password,
      "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva",
    );
    return { data: null, error: { message: "Invalid email or password." } };
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return {
      data: null,
      error: {
        message:
          "Too many failed login attempts. Please try again later or reset your password.",
      },
    };
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    await registerFailedLogin(user);
    return { data: null, error: { message: "Invalid email or password." } };
  }

  if (!user.email_verified) {
    return {
      data: null,
      error: { message: "Please verify your email before signing in." },
    };
  }

  await clearFailedLogins(user.id);

  return {
    data: await createSessionForUser(user),
    error: null,
  };
}

async function registerFailedLogin(user) {
  const attempts = (user.failed_login_attempts || 0) + 1;
  const shouldLock = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;
  const lockedUntil = shouldLock
    ? new Date(Date.now() + ACCOUNT_LOCKOUT_MINUTES * 60 * 1000).toISOString()
    : null;

  await db.execute({
    sql: "UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?",
    args: [attempts, lockedUntil, user.id],
  });
}

async function clearFailedLogins(userId) {
  await db.execute({
    sql: "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
    args: [userId],
  });
}

export async function getUserByToken(token) {
  try {
    const payload = jwt.verify(token, requiredSecret("JWT_SECRET"));
    const result = await db.execute({
      sql: "SELECT id, email, role FROM users WHERE id = ?",
      args: [payload.id],
    });
    const user = result.rows[0];
    if (!user) return { data: null, error: { message: "User not found." } };
    return { data: { user }, error: null };
  } catch {
    return { data: null, error: { message: "Invalid or expired token." } };
  }
}

export async function refreshSession(refreshToken) {
  try {
    const payload = jwt.verify(
      refreshToken,
      requiredSecret("JWT_REFRESH_SECRET"),
    );

    const stored = await db.execute({
      sql: "SELECT id, revoked, expires_at FROM refresh_tokens WHERE token_hash = ? AND user_id = ?",
      args: [tokenHash(refreshToken), payload.id],
    });

    const tokenRow = stored.rows[0];
    if (!tokenRow || tokenRow.revoked) {
      return {
        data: null,
        error: { message: "Refresh token revoked or not found." },
      };
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return { data: null, error: { message: "Refresh token expired." } };
    }

    const userResult = await db.execute({
      sql: "SELECT id, email, role FROM users WHERE id = ?",
      args: [payload.id],
    });
    const user = userResult.rows[0];
    if (!user) return { data: null, error: { message: "User not found." } };

    await db.execute({
      sql: "UPDATE refresh_tokens SET revoked = 1 WHERE id = ?",
      args: [tokenRow.id],
    });

    const newPayload = { id: user.id, email: user.email, role: user.role };
    const newAccessToken = signAccess(newPayload);
    const newRefreshToken = signRefresh(newPayload);
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRY_MS,
    ).toISOString();

    await db.execute({
      sql: "INSERT INTO refresh_tokens (user_id, token, token_hash, expires_at) VALUES (?, ?, ?, ?)",
      args: [
        user.id,
        tokenHash(newRefreshToken),
        tokenHash(newRefreshToken),
        expiresAt,
      ],
    });

    return {
      data: {
        session: {
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          expires_at: Math.floor(Date.now() / 1000) + 15 * 60,
        },
        user,
      },
      error: null,
    };
  } catch {
    return {
      data: null,
      error: { message: "Invalid or expired refresh token." },
    };
  }
}

export async function revokeRefreshSession(refreshToken) {
  if (!refreshToken) return;

  await db.execute({
    sql: "UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?",
    args: [tokenHash(refreshToken)],
  });
}

export async function createPasswordResetToken(email) {
  await cleanupExpiredAuthRows();
  const userResult = await db.execute({
    sql: "SELECT id, email FROM users WHERE email = ?",
    args: [email],
  });
  const user = userResult.rows[0];
  if (!user) {
    return { data: null, error: null };
  }

  const token = randomToken();
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000,
  ).toISOString();

  await db.execute({
    sql: "DELETE FROM password_reset_tokens WHERE user_id = ?",
    args: [user.id],
  });
  await db.execute({
    sql: "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    args: [user.id, tokenHash(token), expiresAt],
  });

  return { data: { email: user.email, token, expiresAt }, error: null };
}

export async function resetPasswordWithToken(token, password) {
  await cleanupExpiredAuthRows();
  const result = await db.execute({
    sql: `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at
          FROM password_reset_tokens prt
          WHERE prt.token_hash = ?`,
    args: [tokenHash(token)],
  });
  const record = result.rows[0];

  if (!record || record.used_at || new Date(record.expires_at) <= new Date()) {
    return { error: { message: "Invalid or expired reset token." } };
  }

  const passwordHash = await hashPassword(password);
  await db.batch(
    [
      {
        sql: "UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?",
        args: [passwordHash, record.user_id],
      },
      {
        sql: "UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?",
        args: [record.id],
      },
      {
        sql: "UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?",
        args: [record.user_id],
      },
    ],
    "write",
  );

  return { error: null };
}

// ── FIX: Hard-delete a user by their users.id ─────────────────────────────────
// Because the schema has ON DELETE CASCADE on every child table
// (candidate_profiles → candidate_form, candidate_status, candidate_quiz,
//  refresh_tokens), deleting from users is all that's needed.
// After this, the email is completely free and signup will succeed again.
export async function deleteUserById(userId) {
  try {
    await db.execute({
      sql: "DELETE FROM users WHERE id = ?",
      args: [userId],
    });
    return { error: null };
  } catch (err) {
    return { error: { message: err.message } };
  }
}
