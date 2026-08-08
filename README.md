# Recruitment Portal

A recruitment and assessment portal for candidate registration, OTP verification, attendance scanning, scheduled quizzes, results, and administrator operations.

The application is split into a React/Vite frontend and an Express backend. Turso/libSQL stores portal data, while Redis and BullMQ absorb bursts of quiz submissions so candidates are not held up by database writes.

## What the portal supports

- Candidate sign-up, OTP verification, login, password reset, and profile completion.
- Candidate dashboard, exam instructions, quiz attempt, and results.
- Admin candidate management, attendance, registration controls, quiz question management, and slot scheduling.
- Scanner flow for validating candidate attendance.
- Socket.IO updates for live portal state.
- Redis-backed, idempotent quiz submission processing.

## Architecture

```text
React + Vite frontend
        |
        v
Express API + Socket.IO
        |                 \
        v                  v
Turso/libSQL           Redis + BullMQ
                              |
                              v
                       Quiz submission worker
```

## Repository layout

```text
frontend/       React application and Vite configuration
backend/        Express API, database access, queue worker, and load scripts
docs/           Operational documentation and load-test runbooks
```

## Prerequisites

- Node.js 20 or newer
- npm
- A Turso/libSQL database and auth token
- A Redis instance reachable by the backend
- SMTP credentials when real OTP and email delivery are enabled
- k6 for the Redis quiz-submission load test

## Run locally

1. Set up and start the backend.

```powershell
cd backend
npm install
Copy-Item .env.example .env
# Fill in backend/.env with database, Redis, JWT, and SMTP values.
npm run dev
```

2. Set up and start the frontend in a second terminal.

```powershell
cd frontend
npm install
$env:VITE_API_BASE_URL = "http://localhost:5000"
npm run dev
```

Vite prints the local frontend URL. The backend defaults to `http://localhost:5000` unless `PORT` is changed.

## Configuration

Use [backend/.env.example](/D:/Projects/MERN/recruitment-portal-26/backend/.env.example) as the source of truth for backend configuration. At minimum, production requires:

- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
- `REDIS_URL`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `OTP_SECRET`
- `CLIENT_ORIGIN`
- SMTP values for OTP delivery

The frontend uses `VITE_API_BASE_URL` to find the API. Do not commit `.env` files or real service credentials.

## Quiz submissions and Redis

Quiz submissions are placed on a BullMQ queue and the API responds with `202 Accepted` once the queue has accepted the job. The worker performs the durable database write. Jobs are keyed by candidate ID, which prevents duplicate submissions from creating duplicate results.

Set `QUIZ_SUBMIT_CONCURRENCY` based on Redis, database capacity, and observed write latency. The current load-test baseline uses `50` concurrent worker jobs.

## Load testing

The project includes scripts to seed test candidates, clear the quiz queue, submit quiz attempts using k6, and verify the final result. See [the load-testing guide](/D:/Projects/MERN/recruitment-portal-26/docs/LOAD_TESTING.md) for the full runbook and expected metrics.

## Deployment

Build the frontend and run the backend with `NODE_ENV=production`. Ensure the deployed backend can reach Turso, Redis, and SMTP, and set `CLIENT_ORIGIN` to the deployed frontend origin. Keep the backend process alive with a service manager or platform process manager.

For security and production hardening details, see [backend/DEPLOYMENT_SECURITY.md](/D:/Projects/MERN/recruitment-portal-26/backend/DEPLOYMENT_SECURITY.md). Backend-specific setup is in [backend/README.md](/D:/Projects/MERN/recruitment-portal-26/backend/README.md), and frontend development notes are in [frontend/README.md](/D:/Projects/MERN/recruitment-portal-26/frontend/README.md).
