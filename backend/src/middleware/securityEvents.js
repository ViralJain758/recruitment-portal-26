import logger from "../config/logger.js";

const securityLogger = logger.child({ category: "security" });

function requestContext(req) {
  return {
    ip: req?.ip,
    userAgent: req?.headers?.["user-agent"],
    requestId: req?.requestId,
    path: req?.originalUrl,
  };
}

// ── Authentication / authorization event log ────────────────────────────
// Call this from controllers for every attempt to authenticate (signup,
// login, OTP verification, admin login, scanner login, password reset,
// token refresh) so there is a complete, queryable trail of who tried to
// get in, from where, and whether it worked.
export function logAuthEvent(req, { type, outcome, email, reason, extra } = {}) {
  const payload = {
    event: "auth_attempt",
    type, // e.g. "login", "signup", "admin_otp_verify", "scanner_login", "password_reset"
    outcome, // "success" | "failure"
    email: email ? maskEmail(email) : undefined,
    reason,
    ...requestContext(req),
    ...extra,
  };

  if (outcome === "success") {
    securityLogger.info("Authentication attempt", payload);
  } else {
    securityLogger.warn("Authentication attempt", payload);
  }

  if (outcome === "failure") {
    trackFailure(req, type, email);
  }
}

// Avoid writing raw email addresses (PII) into log storage while keeping
// enough of the value to correlate/search for a specific account.
function maskEmail(email) {
  const [user, domain] = String(email).split("@");
  if (!domain) return "[invalid]";
  const visible = user.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

// ── Lightweight suspicious-activity detection ────────────────────────────
// This is intentionally simple: an in-memory sliding window per IP and per
// (IP + auth-type) pair. It's enough to surface brute-force / credential-
// stuffing patterns in the logs (and to alert on, if the log pipeline is
// wired to an alerting tool) without adding infrastructure.
//
// Caveat: state is per-process, so behind multiple app instances each
// instance only sees its own share of traffic. If this app is scaled
// horizontally, move this tracking to a shared store (e.g. Redis) so
// thresholds are evaluated across all instances.
const WINDOW_MS = 10 * 60 * 1000;
const IP_FAILURE_THRESHOLD = 10;
const IP_TYPE_FAILURE_THRESHOLD = 5;

const ipFailures = new Map();
const ipTypeFailures = new Map();

function bump(map, key) {
  const now = Date.now();
  const existing = map.get(key);
  if (!existing || now - existing.windowStart > WINDOW_MS) {
    map.set(key, { count: 1, windowStart: now });
    return 1;
  }
  existing.count += 1;
  return existing.count;
}

function trackFailure(req, type, email) {
  const ip = req?.ip || "unknown";
  const ipCount = bump(ipFailures, ip);
  const ipTypeCount = bump(ipTypeFailures, `${ip}:${type}`);

  if (ipTypeCount === IP_TYPE_FAILURE_THRESHOLD) {
    securityLogger.warn("Suspicious activity: repeated auth failures from one IP for one endpoint type", {
      event: "suspicious_activity",
      pattern: "repeated_failure_same_type",
      type,
      ip,
      failuresInWindow: ipTypeCount,
      windowMinutes: WINDOW_MS / 60000,
      email: email ? maskEmail(email) : undefined,
    });
  }

  if (ipCount === IP_FAILURE_THRESHOLD) {
    securityLogger.warn("Suspicious activity: high volume of auth failures from one IP across endpoints", {
      event: "suspicious_activity",
      pattern: "repeated_failure_any_type",
      ip,
      failuresInWindow: ipCount,
      windowMinutes: WINDOW_MS / 60000,
    });
  }
}

// Called from rate-limiter `handler` callbacks so that hitting a limit
// (a strong signal of automated abuse) shows up alongside other
// suspicious-activity log lines instead of only as a 429 response.
export function logRateLimitExceeded(req, limiterName) {
  securityLogger.warn("Suspicious activity: rate limit exceeded", {
    event: "suspicious_activity",
    pattern: "rate_limit_exceeded",
    limiter: limiterName,
    ...requestContext(req),
  });
}

// Periodic cleanup so the maps don't grow unbounded on a long-running
// process.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, value] of ipFailures) {
    if (value.windowStart < cutoff) ipFailures.delete(key);
  }
  for (const [key, value] of ipTypeFailures) {
    if (value.windowStart < cutoff) ipTypeFailures.delete(key);
  }
}, WINDOW_MS).unref();

export default { logAuthEvent, logRateLimitExceeded };
