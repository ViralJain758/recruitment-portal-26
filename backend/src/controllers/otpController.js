import { cleanText } from "../utils/text.js";
import { createOTP, verifyOTP, isEmailVerified } from "../models/otpModel.js";
import { sendOTPEmail } from "../services/emailService.js";
import { completeRegistration, getUserByEmail } from "../services/authService.js";
import { logAuthEvent } from "../middleware/securityEvents.js";

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: "/",
  };
}

export async function sendOTP(req, res) {
  const email = cleanText(req.body.email);
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  // Check if user already exists
  const { data: existingUser } = await getUserByEmail(email);
  if (existingUser) {
    return res.status(400).json({ message: "A user with that email already exists." });
  }

  const { otp, expiresAt } = await createOTP(email);
  await sendOTPEmail(email, otp);

  logAuthEvent(req, { type: "otp_send", outcome: "success", email });

  return res.json({
    message: "OTP sent to your email.",
    expiresAt,
  });
}

export async function verifyOTPAndComplete(req, res) {
  const email = cleanText(req.body.email);
  const otp = cleanText(req.body.otp);

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required." });
  }

  const { success, error } = await verifyOTP(email, otp);

  logAuthEvent(req, {
    type: "otp_verify",
    outcome: success ? "success" : "failure",
    email,
    reason: success ? undefined : error,
  });

  if (!success) {
    return res.status(400).json({ message: error });
  }

  // Complete registration
  const { data, error: regError } = await completeRegistration(email);
  if (regError) {
    return res.status(400).json({ message: regError.message });
  }

  res.cookie(REFRESH_COOKIE_NAME, data.refreshToken, refreshCookieOptions());
  return res.status(201).json(data);
}

export async function checkVerificationStatus(req, res) {
  const email = cleanText(req.query.email);
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const verified = await isEmailVerified(email);
  return res.json({ verified });
}
