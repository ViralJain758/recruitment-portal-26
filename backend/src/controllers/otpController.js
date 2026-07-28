import { cleanText } from "../utils/text.js";
import { createOTP, verifyOTP, isEmailVerified } from "../models/otpModel.js";
import { sendOTPEmail } from "../services/emailService.js";
import { completeRegistration, getUserByEmail } from "../services/authService.js";

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

  return res.json({
    message: "OTP sent to your email.",
    expiresAt,
  });
}

export async function verifyOTPAndComplete(req, res) {
  const email = cleanText(req.body.email);
  const otp = cleanText(req.body.otp);
  const password = cleanText(req.body.password);

  if (!email || !otp || !password) {
    return res.status(400).json({ message: "Email, OTP, and password are required." });
  }

  const { success, error } = await verifyOTP(email, otp);
  if (!success) {
    return res.status(400).json({ message: error });
  }

  // Complete registration
  const { data, error: regError } = await completeRegistration(email, password);
  if (regError) {
    return res.status(400).json({ message: regError.message });
  }

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
