import { cleanText } from "../utils/text.js";
import {
  bearerToken,
  fetchCandidateProfile,
  loginUser,
  logoutUser,
  requestPasswordReset,
  registerUser,
  refreshUserSession,
  resetUserPassword,
  saveCandidate,
  userFromToken,
  verifyAdminLoginOtp,
} from "../services/authService.js";
import { logAuthEvent } from "../middleware/securityEvents.js";

const REFRESH_COOKIE_NAME = "refreshToken";
const ADMIN_COOKIE_NAME = "adminSession";
const SCANNER_COOKIE_NAME = "scannerSession";
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const ADMIN_COOKIE_MAX_AGE = 15 * 60 * 1000;

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge,
    path: "/",
  };
}

function setRefreshCookie(res, token) {
  if (token) {
    res.cookie(REFRESH_COOKIE_NAME, token, cookieOptions(REFRESH_COOKIE_MAX_AGE));
  }
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...cookieOptions(0),
    maxAge: undefined,
  });
}

function setAdminCookie(res, token) {
  if (token) {
    res.cookie(ADMIN_COOKIE_NAME, token, cookieOptions(ADMIN_COOKIE_MAX_AGE));
  }
}

function clearAdminCookie(res) {
  res.clearCookie(ADMIN_COOKIE_NAME, {
    ...cookieOptions(0),
    maxAge: undefined,
  });
}

function clearScannerCookie(res) {
  res.clearCookie(SCANNER_COOKIE_NAME, {
    ...cookieOptions(0),
    maxAge: undefined,
  });
}

function sendAuthData(res, data, status = 200) {
  setRefreshCookie(res, data.refreshToken);
  return res.status(status).json(data);
}

function passwordIsStrongEnough(password) {
  return typeof password === "string" && password.length >= 8;
}

export async function signup(req, res) {
  const email = cleanText(req.body.email);
  const password = cleanText(req.body.password);

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  if (!passwordIsStrongEnough(password)) {
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters long." });
  }

  // Start OTP registration flow
  const { data, error } = await registerUser(email, password);

  logAuthEvent(req, {
    type: "signup",
    outcome: error ? "failure" : "success",
    email,
    reason: error?.message,
  });

  if (error) {
    return res.status(400).json({
      message: error.message,
    });
  }

  return res.status(200).json({
    message:
      data.message ||
      "OTP sent to your email. Please verify to complete registration.",
    requiresVerification: true,
    email: data.email || email,
  });
}

export async function login(req, res) {
  const email = cleanText(req.body.email);
  const password = cleanText(req.body.password);

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  const { data, error } = await loginUser(email, password);

  logAuthEvent(req, {
    type: "login",
    outcome: error ? "failure" : "success",
    email,
    reason: error?.message,
    extra: data?.requiresAdminOtp ? { requiresAdminOtp: true } : undefined,
  });

  return error
    ? res.status(401).json({ message: error.message })
    : sendAuthData(res, data);
}

export async function verifyAdminOtp(req, res) {
  const email = cleanText(req.body.email);
  const password = cleanText(req.body.password);
  const otp = cleanText(req.body.otp);

  if (!email || !password || !otp) {
    return res.status(400).json({
      message: "Email, password, and OTP are required.",
    });
  }

  const { data, error } = await verifyAdminLoginOtp(email, password, otp);

  logAuthEvent(req, {
    type: "admin_otp_verify",
    outcome: error ? "failure" : "success",
    email,
    reason: error?.message,
  });

  if (error) {
    return res.status(401).json({ message: error.message });
  }

  setAdminCookie(res, data.adminSession);
  const { adminSession: _adminSession, ...safeData } = data;
  return res.json(safeData);
}

// Normalize snake_case session from authModel into the camelCase shape
// that useAuth.js expects.
function normalizeSession(raw) {
  if (!raw) return null;

  // Already camelCase
  if (raw.accessToken) return raw;

  // Convert snake_case
  return {
    accessToken: raw.access_token,
    expiresAt: raw.expires_at
      ? typeof raw.expires_at === "number"
        ? raw.expires_at
        : Math.floor(new Date(raw.expires_at).getTime() / 1000)
      : null,
  };
}

export async function refresh(req, res) {
  const refreshToken = cleanText(req.cookies?.[REFRESH_COOKIE_NAME]);

  if (!refreshToken) {
    return res.status(400).json({
      message: "Refresh token is required.",
    });
  }

  const { data, error } = await refreshUserSession(refreshToken);

  logAuthEvent(req, {
    type: "token_refresh",
    outcome: error ? "failure" : "success",
    reason: error?.message,
  });

  if (error) {
    return res.status(401).json({
      message: error.message,
    });
  }

  const response = {
    ...data,
    session: normalizeSession(data.session),
  };
  if (data.refreshToken) {
    Object.defineProperty(response, "refreshToken", {
      value: data.refreshToken,
      enumerable: false,
    });
  }

  return sendAuthData(res, response);
}

export async function logout(req, res) {
  const refreshToken = cleanText(req.cookies?.[REFRESH_COOKIE_NAME]);
  await logoutUser(refreshToken);
  logAuthEvent(req, { type: "logout", outcome: "success" });
  clearRefreshCookie(res);
  clearAdminCookie(res);
  clearScannerCookie(res);
  return res.json({ message: "Logged out." });
}

export async function forgotPassword(req, res) {
  const email = cleanText(req.body.email);
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const { data, error } = await requestPasswordReset(email);

  // Outcome is always logged as "success" here because the service layer
  // intentionally returns the same response whether or not the account
  // exists (to avoid leaking which emails are registered) — the log entry
  // still records the attempt for the audit trail.
  logAuthEvent(req, {
    type: "password_reset_request",
    outcome: error ? "failure" : "success",
    email,
    reason: error?.message,
  });

  return error
    ? res.status(400).json({ message: error.message })
    : res.json(data);
}

export async function resetPassword(req, res) {
  const token = cleanText(req.body.token);
  const password = cleanText(req.body.password);

  if (!token || !password) {
    return res.status(400).json({ message: "Token and password are required." });
  }

  if (!passwordIsStrongEnough(password)) {
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters long." });
  }

  const { error } = await resetUserPassword(token, password);

  logAuthEvent(req, {
    type: "password_reset_complete",
    outcome: error ? "failure" : "success",
    reason: error?.message,
  });

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  clearRefreshCookie(res);
  return res.json({ message: "Password reset successfully." });
}

export async function saveCandidateDetails(req, res) {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({
      message: "Candidate details payload is required.",
    });
  }

  const token = bearerToken(req);

  if (!token) {
    return res.status(401).json({
      message: "Missing access token.",
    });
  }

  const user = await userFromToken(token);

  if (!user) {
    return res.status(401).json({
      message: "Invalid or expired session.",
    });
  }

  const { data, error, status } = await saveCandidate(req.body, user);

  if (error) {
    return res.status(status).json({
      message: error,
    });
  }

  req.app.get("io")?.to("admin").emit("candidate:submitted", data);

  return res.status(200).json({
    message: "Candidate details saved.",
    profile: data,
    redirectTo: "/dashboard",
  });
}

export async function me(req, res) {
  const token = bearerToken(req);
  const user = token ? await userFromToken(token) : null;

  if (!user) {
    return res.status(401).json({
      message: "Invalid or expired session.",
    });
  }

  const profile = await fetchCandidateProfile(user.id);

  return res.json({
    user: {
      id: user.id,
      email: user.email,
    },
    profile,
  });
}
