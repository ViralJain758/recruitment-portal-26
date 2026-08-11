import {
  comparePassword,
  consumePendingUser,
  createPasswordResetToken,
  createPendingUser,
  createSessionForUser,
  createUserWithPasswordHash,
  getUserByToken,
  resetPasswordWithToken,
  revokeRefreshSession,
  signIn,
  signAdminSession,
  refreshSession,
  verifyAccessTokenPayload,
} from "../models/authModel.js";

import {
  findCandidateByUserId,
  isValidApplicationNumber,
  mapCandidatePayload,
  upsertCandidateProfile,
  validateCandidatePayload,
} from "../models/candidateModel.js";

import { createOTP, verifyOTP, isEmailVerified } from "../models/otpModel.js";

import {
  sendAdminOTPEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
} from "./emailService.js";
import { getGlobalLock } from "./adminService.js";
import db from "../config/db.js";

// ─────────────────────────────────────────────
// Convert expires_at to Unix timestamp
// ─────────────────────────────────────────────
function toUnixSeconds(value) {
  if (!value) return null;
  if (typeof value === "number") return value;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

export function buildSessionResponse(
  session,
  user,
  profile = null,
  redirectTo = null,
) {
  const response = {
    session: session
      ? {
          accessToken: session.access_token,
          expiresAt: toUnixSeconds(session.expires_at),
        }
      : null,

    user: {
      id: user.id,
      email: user.email,
    },

    profile,
    redirectTo,
  };

  if (session?.refresh_token) {
    Object.defineProperty(response, "refreshToken", {
      value: session.refresh_token,
      enumerable: false,
    });
  }

  return response;
}

export function bearerToken(req) {
  const authorization = req.headers.authorization || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
}

export async function fetchCandidateProfile(userId) {
  const { data, error } = await findCandidateByUserId(userId);

  if (error) throw error;

  return data;
}

// ─────────────────────────────────────────────
// Check whether user already exists
// ─────────────────────────────────────────────
export async function getUserByEmail(email) {
  const result = await db.execute({
    sql: "SELECT id, email, role FROM users WHERE email = ?",
    args: [email],
  });

  return {
    data: result.rows[0],
    error: null,
  };
}

// ─────────────────────────────────────────────
// Register User (OTP Flow)
// ─────────────────────────────────────────────
export async function registerUser(email, password) {
  const globallyLocked = await getGlobalLock();

  if (globallyLocked) {
    return {
      error: {
        message:
          "Registrations are currently closed. New sign-ups are not allowed.",
      },
    };
  }

  // Check if user already exists
  const { data: existingUser } = await getUserByEmail(email);

  if (existingUser) {
    return {
      error: {
        message: "A user with that email already exists.",
      },
    };
  }

  // Generate OTP
  await createPendingUser(email, password);
  const { otp } = await createOTP(email);

  // Send OTP Email
  await sendOTPEmail(email, otp);

  // NOTE:
  // Store email/password temporarily.
  // Recommended: pending_users table or JWT.
  // This function only initiates verification.

  return {
    data: {
      message:
        "OTP sent to your email. Please verify to complete registration.",
      requiresVerification: true,
      email,
    },
  };
}

// ─────────────────────────────────────────────
// Complete Registration after OTP Verification
// ─────────────────────────────────────────────
export async function completeRegistration(email) {
  const { data: pendingUser, error: pendingError } =
    await consumePendingUser(email);
  if (pendingError) return { error: pendingError };

  const { data: user, error } = await createUserWithPasswordHash(
    email,
    pendingUser.passwordHash,
  );

  if (error) return { error };

  const data = await createSessionForUser(user.user);

  return {
    data: buildSessionResponse(
      data.session,
      data.user,
      null,
      "/candidate-details",
    ),
  };
}

// ─────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────
export async function loginUser(email, password) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword =
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.ADMIN_PASSWORD_HASH?.trim();
  const adminOtpEmail = process.env.ADMIN_OTP_EMAIL?.trim();

  if (
    adminEmail &&
    adminPassword &&
    email.toLowerCase() === adminEmail &&
    (await comparePassword(password, adminPassword))
  ) {
    if (!adminOtpEmail) {
      return {
        error: {
          message: "Admin OTP receiver email is not configured.",
        },
      };
    }

    const { otp } = await createOTP(adminOtpEmail);
    await sendAdminOTPEmail(adminOtpEmail, otp);

    return {
      data: {
        requiresAdminOtp: true,
        message: "Admin OTP sent.",
      },
    };
  }

  const { data, error } = await signIn(email, password);

  if (error) return { error };

  const profile = await fetchCandidateProfile(data.user.id);

  return {
    data: buildSessionResponse(
      data.session,
      data.user,
      profile,
      profile?.application_number ? "/dashboard" : "/candidate-details",
    ),
  };
}

// ─────────────────────────────────────────────
// Refresh Session
// ─────────────────────────────────────────────
export async function verifyAdminLoginOtp(email, password, otp) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword =
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.ADMIN_PASSWORD_HASH?.trim();
  const adminOtpEmail = process.env.ADMIN_OTP_EMAIL?.trim();

  if (!adminEmail || !adminPassword) {
    return {
      error: {
        message: "Admin credentials are not securely configured.",
      },
    };
  }

  if (!adminOtpEmail) {
    return {
      error: {
        message: "Admin OTP receiver email is not configured.",
      },
    };
  }

  const validAdminPassword =
    email.toLowerCase() === adminEmail &&
    (await comparePassword(password, adminPassword));

  if (!validAdminPassword) {
    return {
      error: {
        message: "Invalid email or password.",
      },
    };
  }

  const { success, error } = await verifyOTP(adminOtpEmail, otp);

  if (!success) {
    return {
      error: {
        message: error,
      },
    };
  }

  return {
    data: {
      isAdmin: true,
      adminSession: signAdminSession({ email: adminEmail }),
      redirectTo: "/admin-dashboard",
    },
  };
}

export async function refreshUserSession(refreshToken) {
  const { data, error } = await refreshSession(refreshToken);

  if (error) return { error };

  const profile = await fetchCandidateProfile(data.user.id);

  return {
    data: buildSessionResponse(
      data.session,
      data.user,
      profile,
      profile?.application_number ? "/dashboard" : "/candidate-details",
    ),
  };
}

export async function logoutUser(refreshToken) {
  await revokeRefreshSession(refreshToken);
}

export async function requestPasswordReset(email) {
  const { data, error } = await createPasswordResetToken(email);
  if (error) return { error };

  if (data?.token) {
    await sendPasswordResetEmail(data.email, data.token);
  }

  return {
    data: {
      message:
        "If an account exists for that email, a password reset link has been sent.",
    },
  };
}

export async function resetUserPassword(token, password) {
  return resetPasswordWithToken(token, password);
}

// ─────────────────────────────────────────────
// Get User From Token
// ─────────────────────────────────────────────
export async function userFromToken(token) {
  const { data, error } = await getUserByToken(token);

  if (error || !data?.user) return null;

  return data.user;
}

export function userFromAccessTokenPayload(token) {
  return verifyAccessTokenPayload(token);
}

// ─────────────────────────────────────────────
// Save Candidate
// ─────────────────────────────────────────────
export async function saveCandidate(body, user) {
  const globallyLocked = await getGlobalLock();

  if (globallyLocked) {
    return {
      status: 403,
      error:
        "Registrations are currently closed. No new submissions are allowed.",
    };
  }

  const missingFields = validateCandidatePayload(body);

  if (missingFields.length) {
    return {
      status: 400,
      error: `Missing required candidate details: ${missingFields.join(", ")}`,
    };
  }

  if (!isValidApplicationNumber(body.applicationNumber)) {
    return {
      status: 400,
      error: "Application number must be exactly 6 digits.",
    };
  }

  const { data, error } = await upsertCandidateProfile(
    mapCandidatePayload(body, user),
  );

  if (error) {
    return {
      status: 400,
      error: error.message,
    };
  }

  return { data };
}
