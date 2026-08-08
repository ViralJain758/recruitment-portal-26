import rateLimit from "express-rate-limit";
import { logRateLimitExceeded } from "./securityEvents.js";

export function isLoadTestBypassRequest(req) {
  const bypassToken = process.env.LOAD_TEST_BYPASS_TOKEN?.trim();
  if (!bypassToken) return false;
  return req.get("x-load-test-token") === bypassToken;
}

// ── Shared limiter factory ───────────────────────────────────────────────
// Every limiter in this file is built through this one function so they
// all: log to the same "suspicious_activity" pipeline when tripped, send
// standard RateLimit-* headers, and share one place to tune defaults. Keep
// route-specific rate limiting logic here rather than inline in route files
// so the full picture of what's protected (and by how much) is visible in
// one file.
function makeLimiter(name, { windowMs, limit, message, ...options }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const auth = req.headers.authorization;
      if (auth && auth.startsWith("Bearer ")) {
        return auth.slice(7);
      }
      return req.ip;
    },
    message: message ? { message } : undefined,
    skip: isLoadTestBypassRequest,
    ...options,
    handler: (req, res, _next, options) => {
      logRateLimitExceeded(req, name);
      res
        .status(options.statusCode)
        .json(
          options.message || {
            message: "Too many requests. Please try again later.",
          },
        );
    },
  });
}

// ── Login / credential-guessing protection ──────────────────────────────
// Tight window aimed squarely at brute-force and credential-stuffing
// against login and the admin OTP step.
export const authLimiter = makeLimiter("auth", {
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: "Too many authentication attempts. Please try again later.",
  skipSuccessfulRequests: true,
});

// ── Account creation ─────────────────────────────────────────────────────
// Separate from login on purpose: mass-account-creation bots have a
// different traffic shape (bursty, then silent) than credential guessing,
// so it gets its own longer window and its own budget rather than sharing
// login's 5-per-15-minutes ceiling.
export const signupLimiter = makeLimiter("signup", {
  windowMs: 60 * 60 * 1000,
  limit: 8,
  message:
    "Too many accounts created from this location. Please try again later.",
});

export const refreshLimiter = makeLimiter("refresh", {
  windowMs: 15 * 60 * 1000,
  limit: 30,
});

export const passwordResetLimiter = makeLimiter("password_reset", {
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: "Too many password reset requests. Please try again later.",
});

export const otpLimiter = makeLimiter("otp", {
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: "Too many verification attempts. Please try again later.",
  skipSuccessfulRequests: true,
});

export const scannerLimiter = makeLimiter("scanner", {
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: "Too many scanner password attempts. Please try again later.",
  skipSuccessfulRequests: true,
});

// Candidates saving/updating their own profile (signup wizard + later
// edits). Generous enough for a real person correcting typos, tight enough
// to stop a script hammering the endpoint.
export const candidateDetailsLimiter = makeLimiter("candidate_details", {
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Too many profile update attempts. Please slow down and try again.",
});

// ── Quiz endpoints ────────────────────────────────────────────────────────
// Candidate-facing and previously unprotected. Reading questions is
// throttled per-minute (a legitimate candidate loads the quiz once, maybe
// reloads after a hiccup); submitting is throttled per 15 minutes since a
// given candidate should only ever submit once and quizService already
// enforces that — this just stops a script from being able to hammer the
// endpoint while trying.
export const quizLimiter = makeLimiter("quiz", {
  windowMs: 60 * 1000,
  limit: 20,
  message: "Too many requests. Please slow down.",
});

export const quizSubmitLimiter = makeLimiter("quiz_submit", {
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many quiz submission attempts. Please try again later.",
});

// ── Admin endpoints ───────────────────────────────────────────────────────
// These sit behind requireAdminSession/requireScannerPassword already, so
// the threat model here isn't an anonymous attacker — it's a stolen/replayed
// session or a misbehaving script blowing through candidate PII (bulk
// candidate list, quiz question bank) faster than any human admin would.
export const adminReadLimiter = makeLimiter("admin_read", {
  windowMs: 60 * 1000,
  limit: 60,
  message: "Too many requests. Please slow down.",
});

export const adminWriteLimiter = makeLimiter("admin_write", {
  windowMs: 60 * 1000,
  limit: 40,
  message: "Too many requests. Please slow down.",
});

// Unauthenticated status endpoints (e.g. global form lock) that candidate
// dashboards poll. No session behind these, so they need their own floor.
export const publicStatusLimiter = makeLimiter("public_status", {
  windowMs: 60 * 1000,
  limit: 30,
  message: "Too many requests. Please slow down.",
});

// ── AI generation ─────────────────────────────────────────────────────────
// No endpoint in this codebase currently calls out to an AI/LLM provider
// (searched for openai/anthropic/gemini/gpt/"generate" — none found). This
// limiter is here, pre-configured, so that the moment such an endpoint is
// added (e.g. AI-assisted quiz question generation, resume parsing) it can
// be wired in with a single import. AI calls are usually the most
// expensive requests in an app and the easiest to turn into a cost-based
// DoS, hence the tight hourly cap rather than a per-minute one.
export const aiGenerationLimiter = makeLimiter("ai_generation", {
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: "Too many AI generation requests. Please try again later.",
});

// ── Global burst guard ────────────────────────────────────────────────────
// Layered on top of the long 15-minute global limiter already in server.js.
// A short, tight window catches fast scripted bursts (the classic
// "hammer every endpoint as fast as possible" scraping pattern) long
// before the 15-minute ceiling would ever trip.
export const burstLimiter = makeLimiter("burst", {
  windowMs: 10 * 1000,
  limit: 25,
  message: "Too many requests in a short period. Please slow down.",
});

export default {
  authLimiter,
  signupLimiter,
  refreshLimiter,
  passwordResetLimiter,
  otpLimiter,
  scannerLimiter,
  candidateDetailsLimiter,
  quizLimiter,
  quizSubmitLimiter,
  adminReadLimiter,
  adminWriteLimiter,
  publicStatusLimiter,
  aiGenerationLimiter,
  burstLimiter,
};
