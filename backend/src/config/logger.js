// Structured JSON logger.
//
// Deliberately dependency-free: every hosting platform (Render, Railway,
// Fly.io, ECS/Cloud Run, etc.) already collects whatever the process writes
// to stdout/stderr, so writing well-shaped JSON lines there is enough to
// plug into any log aggregator (Datadog, CloudWatch, Grafana Loki, ...)
// without adding a dependency or standing up new infrastructure.
//
// Log level can be tuned with LOG_LEVEL (default: "info" in production,
// "debug" otherwise).

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const configuredLevel = (process.env.LOG_LEVEL || "").trim().toLowerCase();
const defaultLevel = process.env.NODE_ENV === "production" ? "info" : "debug";
const activeLevel = LEVELS[configuredLevel] ?? LEVELS[defaultLevel];

// Field names that should never be written to logs, regardless of where
// they show up in the metadata object (auth attempts, request bodies, etc).
const SENSITIVE_KEYS = new Set([
  "password",
  "newpassword",
  "confirmpassword",
  "otp",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "adminsession",
  "scannersession",
  "secret",
  "jwt_secret",
  "jwt_refresh_secret",
  "otp_secret",
  "turso_auth_token",
  "admin_password",
  "scanner_password",
  "admin_password_hash",
  "scanner_password_hash",
]);

function redact(value, depth = 0) {
  if (value == null || depth > 4) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  if (typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        out[key] = "[redacted]";
      } else {
        out[key] = redact(val, depth + 1);
      }
    }
    return out;
  }

  return value;
}

function write(level, message, meta) {
  if (LEVELS[level] < activeLevel) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...redact(meta || {}),
  };

  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

function baseLogger(bindings = {}) {
  return {
    debug: (message, meta) => write("debug", message, { ...bindings, ...meta }),
    info: (message, meta) => write("info", message, { ...bindings, ...meta }),
    warn: (message, meta) => write("warn", message, { ...bindings, ...meta }),
    error: (message, meta) => write("error", message, { ...bindings, ...meta }),
    // Returns a logger that automatically stamps every line with `bindings`
    // (e.g. { requestId }) so related log lines can be correlated.
    child: (childBindings) => baseLogger({ ...bindings, ...childBindings }),
  };
}

export const logger = baseLogger();
export default logger;
