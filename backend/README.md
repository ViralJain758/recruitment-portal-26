# Recruitment Portal Backend

The backend is an Express service that exposes the portal API, manages Socket.IO connections, initializes database structures lazily (`initSchemaIfNeeded`), sends OTP email, and processes candidate quiz submissions via Upstash QStash (Serverless) or BullMQ (Node host).

## Setup and commands

```powershell
npm install
Copy-Item .env.example .env
# Configure backend/.env.
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the backend with nodemon. |
| `npm start` | Start the backend with Node.js. |

The server uses `PORT` from `.env`, defaulting to `5000`.

## Required configuration

Start with `.env.example`. Do not place secrets in source code or commit `.env`.

| Group | Variables | Notes |
| --- | --- | --- |
| Runtime | `NODE_ENV`, `PORT`, `CLIENT_ORIGIN`, `LOG_LEVEL` | Configure the process and allowed browser origin. |
| Database | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Primary portal database. |
| Serverless Queue | `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `APP_BASE_URL` | Upstash QStash cloud queue configuration for Vercel. |
| Node Queue | `REDIS_URL`, `QUIZ_SUBMIT_CONCURRENCY` | Redis and worker parallelism (for standalone Node host). |
| Security | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `OTP_SECRET` | Use long, unique production secrets. |
| Admin | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_OTP_EMAIL` | Initial administrator configuration. |
| Scanner | `SCANNER_PASSWORD` | Protects scanner access. |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Required for real OTP delivery. |

## API surfaces

| Prefix | Responsibility |
| --- | --- |
| `/api/auth` | Candidate and admin authentication, token refresh, password reset, profile details, current session. |
| `/api/otp` | OTP send, verification, and verification status. |
| `/api/quiz/questions` | Fetch questions and slot configuration. |
| `/api/quiz/submit` | Candidate quiz submission (QStash queue / direct DB fallback). |
| `/api/quiz/process-webhook` | QStash webhook endpoint for async queue processing. |
| `/api/admin` | Candidates, attendance, registration controls, slots, schedules, and quiz administration. |

## Serverless & Webhook Architecture

- **Entrypoint**: `api/index.js` wraps Express for Vercel Node.js Serverless runtime.
- **Lazy Schema**: `initSchemaIfNeeded()` caches the schema promise so cold starts complete in under 300ms.
- **QStash Webhook**: `POST /api/quiz/submit` publishes answers to QStash in ~20ms and responds with `202 Accepted`. QStash calls `POST /api/quiz/process-webhook` with rawBody signature verification.

## Load-test utilities

The scripts in `scripts/load/` support high-concurrency performance testing:

| Script | Purpose |
| --- | --- |
| `seed-quiz-load-test.mjs` | Creates requested dummy candidates and outputs access tokens (`quiz-load-users.json`). |
| `run-load-test.mjs` | Executes worker pool load test firing simultaneous submissions (supports 2,500 to 5,000+ candidates). |
| `test-websocket.mjs` | Health check script for Socket.IO authentication and `slot:refresh` events. |

Read [docs/LOAD_TESTING.md](../docs/LOAD_TESTING.md) before running load scripts.

## Production checklist

- Set `NODE_ENV=production` and a precise `CLIENT_ORIGIN`.
- Add `QSTASH_TOKEN` and `APP_BASE_URL` in Vercel environment variables.
- Provide unique, high-entropy secrets for JWT and OTP signing.
- Configure SMTP and a valid sender address.
- Monitor HTTP errors, webhook delivery in Upstash console, and database write latency.

More deployment hardening guidance is in [DEPLOYMENT_SECURITY.md](DEPLOYMENT_SECURITY.md).
