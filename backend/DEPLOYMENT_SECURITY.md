# Deployment Security Guide

This document covers what was changed to prepare the backend for secure
deployment, and the checklist to follow when actually standing up
production infrastructure.

## 1. HTTPS

- `app.set("trust proxy", 1)` in `server.js` — required so the app correctly
  reads `X-Forwarded-Proto`/`X-Forwarded-For` from whatever reverse proxy or
  load balancer terminates TLS in front of it (Render, Railway, Fly.io, an
  ALB, Nginx, Cloudflare, etc.).
- `src/middleware/httpsEnforce.js` — redirects any plain-HTTP request to
  HTTPS (production only; it's a no-op for local `http://localhost`).
- `helmet()` in `server.js` now sets HSTS explicitly (`max-age=1y`,
  `includeSubDomains`, `preload`) so browsers refuse to downgrade to HTTP
  for this origin once they've seen it once over HTTPS.
- Cookies (`refreshToken`, `adminSession`, `scannerSession`) were already
  set with `secure: true` and `sameSite: "none"` in production — unchanged,
  just confirmed correct.

**What you still need to do:** actually terminate TLS somewhere in front of
the app. Most PaaS providers (Render, Railway, Fly.io, Vercel) do this for
you automatically once you point a custom domain at them and it's issued a
certificate. If self-hosting, put Nginx/Caddy or a cloud load balancer in
front of the Node process with a cert from Let's Encrypt or your CA — don't
terminate TLS inside the Node process itself.

## 2. Secrets

- `src/config/validateEnv.js` runs at startup and **refuses to start in
  production** if any required secret is missing, still equal to the
  `.env.example` placeholder, or shorter than 32 characters — this catches
  the most common "forgot to set a real secret" deploy mistake before it
  ever serves a request.
- `.env` is git-ignored (verified — it has never been committed to this
  repo's history) and `.env.example` documents every variable without real
  values.
- In production, don't ship a `.env` file at all — use your platform's
  secret store (Render "Environment" secrets, Railway "Variables", Fly
  `fly secrets`, AWS Secrets Manager / SSM Parameter Store, GCP Secret
  Manager, Kubernetes `Secret` objects, etc.) so secrets never touch disk in
  the deploy artifact.
- Rotate `JWT_SECRET` / `JWT_REFRESH_SECRET` / `OTP_SECRET` periodically and
  whenever someone with repo/infra access leaves the team. Rotating
  `JWT_SECRET` invalidates all outstanding access tokens and admin
  sessions; rotating `JWT_REFRESH_SECRET` invalidates all refresh tokens
  (forces everyone to log in again).
- `ADMIN_PASSWORD` / `SCANNER_PASSWORD` now hold the direct admin/scanner
  password values. Keep those secrets in your host's secret manager and
  never commit real values to the repo. Legacy `*_PASSWORD_HASH` values are
  still accepted temporarily for migration, but the plaintext env vars are
  the preferred path.
- `src/config/supabase.js` is dead code (nothing imports it) left over from
  an earlier iteration, and requires `SUPABASE_*` env vars that don't exist
  anywhere else in this project. It's been flagged in the file itself —
  delete it if it's genuinely unused, since an idle client wired to a
  service-role key is an unnecessary secret to keep alive.

## 3. Restricting database access

The app talks to Turso (libSQL) over HTTPS with a bearer auth token
(`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` in `src/config/db.js`) rather
than a raw Postgres/MySQL TCP port — there's no database port to
accidentally leave open to the public internet in the first place, which is
the biggest win here.

To keep it that way:

- Use a **scoped, least-privilege Turso auth token** for this app (not an
  org-wide admin token). Turso supports mint-per-database tokens with
  read-only or read-write scopes and expirations — use the narrowest one
  that works.
- Never expose `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` to the frontend —
  they're only referenced in backend code (`src/config/db.js`), confirmed
  not present in `frontend/`.
- If you ever migrate to a self-hosted Postgres/MySQL instead of Turso,
  the equivalent hardening is: put it in a private subnet/VPC with no
  public IP, allow inbound connections only from the app server's security
  group, require TLS for the connection, and use a dedicated
  least-privilege DB user (not a superuser) for the app.
- Rotate the Turso auth token the same way you'd rotate any other secret
  (see §2).

## 4. Logging (authentication attempts, API errors, unusual traffic)

- `src/config/logger.js` — dependency-free structured JSON logger. Every
  line is a JSON object with `timestamp`, `level`, `message`, and context
  fields, written to stdout (info/debug) or stderr (warn/error). This is
  intentionally dependency-free so it works immediately without an `npm
install` of a new package, and slots into whatever log pipeline your host
  already provides (Render/Railway/Fly all capture stdout/stderr
  automatically; pipe to Datadog/CloudWatch/Loki/etc. from there).
  Sensitive fields (`password`, `otp`, `token`, `secret`, cookie names,
  etc.) are redacted automatically, even nested inside metadata objects.
- `src/middleware/requestLogger.js` — logs every request with a unique
  request ID (also returned as `X-Request-Id`), method, path, status,
  latency, IP, and user agent. 4xx responses log at `warn`, 5xx at `error`.
- The global Express error handler in `server.js` now logs the full error
  (message + stack) server-side with the request ID, and only ever returns
  a generic message to the client for 5xx errors — no stack traces leak
  over the wire.
- `src/middleware/securityEvents.js` — `logAuthEvent()` is called from every
  authentication-adjacent endpoint (signup, login, admin OTP verify, OTP
  send/verify, password reset request/complete, token refresh, logout,
  scanner login, and failed admin-session checks) and logs a structured
  `auth_attempt` event with outcome, masked email, IP, and reason for
  failure.
- **Unusual traffic patterns**: the same module tracks failed-auth counts
  per IP (and per IP+endpoint-type) in a sliding 10-minute window and logs
  a `suspicious_activity` warning once a threshold is crossed (5 failures
  against one endpoint type, or 10 failures total, from one IP). Every
  `express-rate-limit` limiter (global, auth, OTP, password reset, scanner)
  now also logs a `suspicious_activity` event whenever it actually blocks a
  request, since hitting a rate limit is itself a strong abuse signal.

  This in-memory tracking is per-process — if you scale the app to
  multiple instances, the failure counts won't be shared across them. For
  a single-instance deployment (fine for this app's scale) it works as-is;
  if you scale horizontally later, move the counters into Redis (or
  equivalent) so thresholds are evaluated across all instances.

### Recommended production log setup

1. Point your host's log stream at a log aggregator that supports
   structured JSON (Datadog, Better Stack, Grafana Loki, CloudWatch Logs
   Insights all parse JSON lines natively).
2. Alert on `"event":"suspicious_activity"` and on `"level":"error"` —
   those two queries alone cover brute-force attempts, rate-limit abuse,
   and unhandled server errors.
3. Keep auth logs for a reasonable retention window (30–90 days is typical)
   for incident investigation, and be mindful that they contain masked
   emails and IP addresses — treat the log store itself as holding PII.

## 5. Verifying this deployment

Before going live, confirm:

- [ ] `NODE_ENV=production` is set in the actual deployment environment.
- [ ] `CLIENT_ORIGIN` is set to the real frontend domain(s), not localhost.
- [ ] All secrets in the platform's secret store are freshly generated
      (not copied from `.env.example` or a shared dev `.env`).
- [ ] The app is only reachable over HTTPS (test that plain `http://` on
      the production domain redirects).
- [ ] `/health` responds `200` and logs show `"message":"Server started"`
      at boot with `"environment":"production"`.
- [ ] A deliberately failed login shows up in logs as an `auth_attempt`
      with `"outcome":"failure"`, and 5 failed attempts against `/api/auth/
    login` from one IP produce a `suspicious_activity` log line.
