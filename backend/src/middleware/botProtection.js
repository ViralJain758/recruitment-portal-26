import logger from "../config/logger.js";

const securityLogger = logger.child({ category: "security" });

// ── Known automation client blocking ─────────────────────────────────────
// This is a low-confidence, high-precision check: it only catches scripts
// sending their HTTP library's *default, unchanged* User-Agent string. It
// is not a substitute for rate limiting (a real browser-shaped bot sails
// straight through it) — it just removes the cheapest, laziest scraping
// attempts for free. Anything sophisticated enough to spoof a browser UA is
// left to the rate limiters and slow-down below, which don't depend on the
// client being honest about what it is.
const BOT_UA_PATTERNS = [
  /^curl\//i,
  /^python-requests/i,
  /^python-urllib/i,
  /^go-http-client/i,
  /^axios\//i,
  /^okhttp/i,
  /scrapy/i,
  /headlesschrome/i,
  /phantomjs/i,
  /^java\//i,
  /^libwww-perl/i,
  /^wget\//i,
  /^node-fetch/i,
];

// Only apply this to candidate-facing write/auth endpoints (signup, login,
// OTP, candidate detail saves, quiz submission) — never globally. Health
// checks, uptime monitors, and admin-side internal tooling legitimately use
// plain HTTP clients, and blocking them there would just break monitoring.
export function blockKnownBots(req, res, next) {
  const ua = req.headers["user-agent"];

  if (!ua || !ua.trim()) {
    securityLogger.warn("Blocked request with missing User-Agent", {
      event: "suspicious_activity",
      pattern: "missing_user_agent",
      ip: req.ip,
      path: req.originalUrl,
    });
    return res.status(403).json({ message: "Request blocked." });
  }

  if (BOT_UA_PATTERNS.some((pattern) => pattern.test(ua))) {
    securityLogger.warn("Blocked request from known automation client", {
      event: "suspicious_activity",
      pattern: "bot_user_agent",
      ip: req.ip,
      path: req.originalUrl,
      userAgent: ua,
    });
    return res.status(403).json({ message: "Request blocked." });
  }

  return next();
}

// ── Progressive slow-down ────────────────────────────────────────────────
// Adds an increasing artificial delay the more requests a single IP makes
// against a given endpoint "bucket" within the window, *before* the hard
// rate-limit ceiling in rateLimiters.js is ever reached. A human retrying a
// failed login a couple of times never notices; a script looping as fast as
// possible gets progressively throttled toward a crawl. Implemented as a
// plain in-memory map (same pattern as the failure tracking in
// securityEvents.js) so it needs no extra dependency or infrastructure.
//
// Caveat: like the tracking in securityEvents.js, this state is per-process.
// If this app is ever scaled to multiple instances, move it to a shared
// store (e.g. Redis) so the threshold is evaluated across all of them.
const WINDOW_MS = 60 * 1000;
const FREE_REQUESTS = 10; // no added delay for the first N requests per window
const DELAY_MS_PER_REQUEST = 250; // extra delay per request past the free threshold
const MAX_DELAY_MS = 5000;

const hits = new Map();

export function slowDown(bucket) {
  return (req, res, next) => {
    const key = `${bucket}:${req.ip}`;
    const now = Date.now();
    const existing = hits.get(key);

    let count;
    if (!existing || now - existing.windowStart > WINDOW_MS) {
      count = 1;
      hits.set(key, { count, windowStart: now });
    } else {
      existing.count += 1;
      count = existing.count;
    }

    if (count <= FREE_REQUESTS) return next();

    const delay = Math.min((count - FREE_REQUESTS) * DELAY_MS_PER_REQUEST, MAX_DELAY_MS);
    setTimeout(next, delay);
  };
}

// Periodic cleanup so the map doesn't grow unbounded on a long-running
// process.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, value] of hits) {
    if (value.windowStart < cutoff) hits.delete(key);
  }
}, WINDOW_MS).unref();

export default { blockKnownBots, slowDown };
