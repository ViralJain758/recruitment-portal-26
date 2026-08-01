import db from "../config/db.js";
import crypto from "crypto";

const OTP_EXPIRY_MINUTES = 10;

export async function ensureEmailVerificationsTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT NOT NULL,
      otp        TEXT,
      otp_hash   TEXT,
      expires_at TEXT NOT NULL,
      verified   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  async function ensureColumn(tableName, columnName, definition) {
    const infoResult = await db.execute(`PRAGMA table_info(${tableName})`);
    const exists = infoResult.rows.some((row) => row.name === columnName);
    if (!exists) {
      await db.execute(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
    }
  }

  await ensureColumn("email_verifications", "otp_hash", "otp_hash TEXT");

  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email)",
  );
}

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

function hashOTP(otp) {
  const secret = process.env.OTP_SECRET?.trim();
  if (!secret) {
    throw new Error("OTP_SECRET is not configured.");
  }
  return crypto.createHmac("sha256", secret).update(otp).digest("hex");
}

// Constant-time string comparison to avoid leaking hash-match progress via timing.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal-length buffers so the timing doesn't
    // trivially reveal a length mismatch.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function createOTP(email) {
  const otp = generateOTP();
  const expiresAt = new Date(
    Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
  ).toISOString();

  // Delete any existing OTP for this email
  await db.execute({
    sql: "DELETE FROM email_verifications WHERE email = ?",
    args: [email],
  });

  await db.execute({
    sql: "INSERT INTO email_verifications (email, otp, otp_hash, expires_at) VALUES (?, ?, ?, ?)",
    args: [email, otp, hashOTP(otp), expiresAt],
  });

  return { otp, expiresAt };
}

export async function verifyOTP(email, otp) {
  const result = await db.execute({
    sql: "SELECT id, otp, otp_hash, expires_at, verified FROM email_verifications WHERE email = ? ORDER BY created_at DESC LIMIT 1",
    args: [email],
  });

  const record = result.rows[0];
  const submittedHash = hashOTP(otp);
  const hashMatch =
    Boolean(record?.otp_hash) && safeEqual(record.otp_hash, submittedHash);

  if (!record || !hashMatch) {
    return { success: false, error: "Invalid OTP." };
  }

  if (record.verified) {
    return { success: false, error: "OTP already used." };
  }

  if (new Date(record.expires_at) < new Date()) {
    return { success: false, error: "OTP has expired." };
  }

  // Mark as verified
  await db.execute({
    sql: "UPDATE email_verifications SET verified = 1 WHERE id = ?",
    args: [record.id],
  });

  return { success: true };
}

export async function isEmailVerified(email) {
  const result = await db.execute({
    sql: "SELECT verified FROM email_verifications WHERE email = ? ORDER BY created_at DESC LIMIT 1",
    args: [email],
  });

  const record = result.rows[0];
  return record ? Boolean(record.verified) : false;
}
