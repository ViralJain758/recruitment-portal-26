import db from "../config/db.js";
import crypto from "crypto";

const OTP_EXPIRY_MINUTES = 10;

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

export async function createOTP(email) {
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  // Delete any existing OTP for this email
  await db.execute({
    sql: "DELETE FROM email_verifications WHERE email = ?",
    args: [email],
  });

  await db.execute({
    sql: "INSERT INTO email_verifications (email, otp, expires_at) VALUES (?, ?, ?)",
    args: [email, otp, expiresAt],
  });

  return { otp, expiresAt };
}

export async function verifyOTP(email, otp) {
  const result = await db.execute({
    sql: "SELECT id, expires_at, verified FROM email_verifications WHERE email = ? AND otp = ?",
    args: [email, otp],
  });

  const record = result.rows[0];
  if (!record) {
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