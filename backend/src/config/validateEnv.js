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

const MIN_SECRET_LENGTH = 32;

/**
 * Validates that required secrets are present, unique, and not left as the
 * example placeholders before the server starts accepting traffic.
 *
 * In production this throws (so the process exits instead of serving
 * requests with insecure defaults). In development it only warns, so local
 * setup isn't blocked.
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

  if (isProduction && !(process.env.CLIENT_ORIGIN || "").trim()) {
    problems.push(
      "CLIENT_ORIGIN must be set in production so CORS isn't left wide open.",
    );
  }

  if (problems.length === 0) {
    logger.info("Environment configuration validated.", {
      environment: process.env.NODE_ENV || "development",
    });
    return;
  }

  for (const problem of problems) {
    logger.error("Startup configuration problem", { problem });
  }

  if (isProduction) {
    throw new Error(
      `Refusing to start in production with ${problems.length} configuration problem(s). See logged errors above.`,
    );
  }

  logger.warn(
    "Starting with insecure/incomplete configuration. This is only tolerated outside production.",
    { problemCount: problems.length },
  );
}

export default validateEnv;
