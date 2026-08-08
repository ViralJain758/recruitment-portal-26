import logger from "./logger.js";

// Values copied straight from .env.example — if any of these are still set
// at runtime it means a real secret was never generated for this
// environment.
const PLACEHOLDER_VALUES = new Set([
  "replace-with-a-long-random-secret",
  "replace-with-a-different-long-random-secret",
  "replace-with-a-real-password",
  "your-turso-database-url",
  "your-turso-auth-token",
  "admin@example.com",
  "$2b$12$replace-with-a-real-bcrypt-hash",
  "admin-otp-recipient@example.com",
  "smtp.example.com",
  "your-smtp-username",
  "your-smtp-password",
]);

const isVercelEnvironment = Boolean(
  process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_BUILDER,
);

const REQUIRED_VARS = [
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "OTP_SECRET",
  "ADMIN_EMAIL",
  ["ADMIN_PASSWORD", "ADMIN_PASSWORD_HASH"],
  "ADMIN_OTP_EMAIL",
  ["SCANNER_PASSWORD", "SCANNER_PASSWORD_HASH"],
];

// REDIS_URL is required only if QSTASH_TOKEN is not provided and not on Vercel
if (!process.env.QSTASH_TOKEN && !isVercelEnvironment) {
  REQUIRED_VARS.push("REDIS_URL");
}

const MIN_SECRET_LENGTH = 32;

/**
 * Validates that required secrets are present, unique, and not left as the
 * example placeholders before the server starts accepting traffic.
 */
export function validateEnv() {
  const isProduction = process.env.NODE_ENV === "production";
  const problems = [];

  for (const name of REQUIRED_VARS) {
    if (Array.isArray(name)) {
      const [primaryName, legacyName] = name;
      const value =
        process.env[primaryName]?.trim() || process.env[legacyName]?.trim();

      if (!value) {
        problems.push(
          `${primaryName} is not set. Provide ${primaryName} or the legacy ${legacyName}.`,
        );
        continue;
      }

      if (PLACEHOLDER_VALUES.has(value)) {
        problems.push(
          `${primaryName} is still set to its .env.example placeholder value.`,
        );
      }

      continue;
    }

    const value = process.env[name]?.trim();

    if (!value) {
      problems.push(`${name} is not set.`);
      continue;
    }

    if (PLACEHOLDER_VALUES.has(value)) {
      problems.push(
        `${name} is still set to its .env.example placeholder value.`,
      );
    }
  }

  for (const name of ["JWT_SECRET", "JWT_REFRESH_SECRET", "OTP_SECRET"]) {
    const value = process.env[name]?.trim();
    if (value && value.length < MIN_SECRET_LENGTH) {
      problems.push(
        `${name} is only ${value.length} characters. Use at least ${MIN_SECRET_LENGTH} random characters (e.g. \`openssl rand -hex 32\`).`,
      );
    }
  }

  if (
    process.env.JWT_SECRET &&
    process.env.JWT_REFRESH_SECRET &&
    process.env.JWT_SECRET.trim() === process.env.JWT_REFRESH_SECRET.trim()
  ) {
    problems.push(
      "JWT_SECRET and JWT_REFRESH_SECRET must be different values.",
    );
  }

  if (problems.length === 0) {
    logger.info("Environment configuration validated.", {
      environment: process.env.NODE_ENV || "development",
    });
    return;
  }

  for (const problem of problems) {
    logger.warn("Startup configuration warning", { problem });
  }

  // Do not crash serverless functions at startup; log warnings so preflight and requests complete cleanly
  if (isProduction && !isVercelEnvironment) {
    logger.error(`Starting production server with ${problems.length} warning(s).`);
  }
}

export default validateEnv;
