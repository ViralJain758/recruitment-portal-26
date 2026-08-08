# Recruitment Portal Backend

The backend is an Express service that exposes the portal API, manages Socket.IO connections, initializes database structures, sends OTP email, and runs the Redis/BullMQ quiz submission worker.

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
| Queue | `REDIS_URL`, `QUIZ_SUBMIT_CONCURRENCY` | Redis and worker parallelism. |
| Security | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `OTP_SECRET` | Use long, unique production secrets. |
| Admin | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_OTP_EMAIL` | Initial administrator configuration. |
| Scanner | `SCANNER_PASSWORD` | Protects scanner access. |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Required for real OTP delivery. |

## API surfaces

| Prefix | Responsibility |
| --- | --- |
| `/api/auth` | Candidate and admin authentication, token refresh, password reset, profile details, current session. |
| `/api/otp` | OTP send, verification, and verification status. |
| `/api/quiz` | Quiz questions and candidate quiz submission. |
| `/api/admin` | Candidates, attendance, registration controls, slots, schedules, and quiz administration. |
| `/dashboard` | Dashboard-related data. |

Routes that process candidate data require authentication and apply request validation and protection middleware.

## Quiz submission worker

`POST /api/quiz/submit` validates the candidate and queues a BullMQ job in Redis. It responds with `202 Accepted` when the queue receives the job. The worker writes the submission to Turso/libSQL asynchronously.

Jobs use a stable candidate-based job ID, so repeated submits do not create duplicate submissions. This keeps the quiz endpoint responsive during bursts while preserving at-most-one durable result per candidate.

`QUIZ_SUBMIT_CONCURRENCY=50` is the current starting point for the 1,500-candidate benchmark. Tune it only with a real database and Redis measurement; a higher number can shift the bottleneck from the API to database writes.

## Load-test utilities

The scripts in `scripts/load/` support a disposable local or staging test:

| Script | Purpose |
| --- | --- |
| `clear-quiz-load-queue.mjs` | Removes pending load-test queue work. |
| `seed-quiz-load-test.mjs` | Creates the requested dummy candidates and records their test credentials. |
| `quiz-submit-batched.k6.js` | Sends submissions in controlled waves, 50 at once by default. |
| `quiz-submit-instant.k6.js` | Starts all submissions immediately to test the connection and API burst limit. |
| `quiz-load-status.mjs` | Reports queue, submission, and database completion state. |

Read [docs/LOAD_TESTING.md](/D:/Projects/MERN/recruitment-portal-26/docs/LOAD_TESTING.md) before running these scripts. The bypass token exists only for isolated testing and must never be exposed in a public or production client.

## Production checklist

- Set `NODE_ENV=production` and a precise `CLIENT_ORIGIN`.
- Use managed, authenticated TLS connections for Turso and Redis.
- Provide unique, high-entropy secrets for JWT and OTP signing.
- Configure SMTP and a valid sender address.
- Run a single backend release with its queue worker enabled, then confirm Redis connectivity before allowing an exam window.
- Monitor HTTP errors, queue depth, failed jobs, and database write latency.

More deployment hardening guidance is in [DEPLOYMENT_SECURITY.md](/D:/Projects/MERN/recruitment-portal-26/backend/DEPLOYMENT_SECURITY.md).
