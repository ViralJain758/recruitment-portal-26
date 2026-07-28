import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../config/db.js";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

function signAccess(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function signRefresh(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export async function createUser(email, password) {
  const hash = await bcrypt.hash(password, 12);
  try {
    const result = await db.execute({
      sql: "INSERT INTO users (email, password, role) VALUES (?, ?, 'user')",
      args: [email, hash],
    });
    const user = await db.execute({
      sql: "SELECT id, email, role FROM users WHERE id = ?",
      args: [Number(result.lastInsertRowid)],
    });
    return { data: { user: user.rows[0] }, error: null };
  } catch (err) {
    if (err.message?.includes("UNIQUE")) {
      return { data: null, error: { message: "A user with that email already exists." } };
    }
    return { data: null, error: { message: err.message } };
  }
}

export async function signIn(email, password) {
  const result = await db.execute({
    sql: "SELECT id, email, password, role FROM users WHERE email = ?",
    args: [email],
  });

  const user = result.rows[0];
  if (!user) {
    return { data: null, error: { message: "Invalid email or password." } };
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return { data: null, error: { message: "Invalid email or password." } };
  }

  const payload = { id: user.id, email: user.email, role: user.role };
  const accessToken = signAccess(payload);
  const refreshToken = signRefresh(payload);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.execute({
    sql: "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
    args: [user.id, refreshToken, expiresAt],
  });

  return {
    data: {
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: Math.floor(Date.now() / 1000) + 15 * 60,
      },
      user: { id: user.id, email: user.email, role: user.role },
    },
    error: null,
  };
}

export async function getUserByToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
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
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const stored = await db.execute({
      sql: "SELECT id, revoked, expires_at FROM refresh_tokens WHERE token = ? AND user_id = ?",
      args: [refreshToken, payload.id],
    });

    const tokenRow = stored.rows[0];
    if (!tokenRow || tokenRow.revoked) {
      return { data: null, error: { message: "Refresh token revoked or not found." } };
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
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.execute({
      sql: "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      args: [user.id, newRefreshToken, expiresAt],
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
    return { data: null, error: { message: "Invalid or expired refresh token." } };
  }
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