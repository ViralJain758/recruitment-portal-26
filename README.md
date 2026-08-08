# Recruitment Portal

A high-performance recruitment and assessment portal for candidate registration, OTP verification, attendance scanning, scheduled quizzes, results, and administrator operations.

The application is split into a React/Vite frontend and an Express backend. Turso/libSQL stores portal data. The backend supports **Vercel Serverless Mode with Upstash QStash cloud queueing** (or standard **Node.js mode with Redis/BullMQ**) to absorb high-concurrency bursts of quiz submissions during exam slot timers.

## What the portal supports

- Candidate sign-up, OTP verification, login, password reset, and profile completion.
- Candidate dashboard, exam instructions, quiz attempt, and results.
- Admin candidate management, attendance, registration controls, quiz question management, and slot scheduling.
- Scanner flow for validating candidate attendance.
- Socket.IO updates for real-time portal state (in Node mode) and polling sync (in Vercel Edge mode).
- High-concurrency quiz submission processing via Upstash QStash (Serverless) or BullMQ (Node daemon), with direct DB fallback.

## Architecture

```text
React + Vite frontend
        |
        v
Express API (Vercel Serverless / Node.js)
        |                               \
        v                                v
Turso/libSQL (Edge DB)           Upstash QStash (Cloud Queue) / Redis
                                        |
                                        v
                               Webhook / Worker Processor
```

## Repository layout

```text
frontend/       React application and Vite configuration
backend/        Express API, database access, queue worker, serverless entrypoints, and load scripts
docs/           Operational documentation and load-test runbooks
```

## Prerequisites

- Node.js 20 or newer
- npm
- A Turso/libSQL database and auth token
- An Upstash QStash token (for Vercel deployment) or Redis instance (for standalone Node host)
- SMTP credentials for OTP delivery

## Run locally

1. Set up and start the backend.

```powershell
cd backend
npm install
Copy-Item .env.example .env
# Fill in backend/.env with database, QStash/Redis, JWT, and SMTP values.
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

Use [backend/.env.example](backend/.env.example) as the source of truth for backend configuration. At minimum, production requires:

- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
- `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` (for Vercel deployment) or `REDIS_URL` (for Node host)
- `APP_BASE_URL` (e.g. `https://recruitment-portal-26-5jfu.vercel.app`)
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `OTP_SECRET`
- `CLIENT_ORIGIN`
- SMTP values for OTP delivery

The frontend uses `VITE_API_BASE_URL` to find the API. Do not commit `.env` files or real service credentials.

## Serverless & Quiz Submission Architecture

- **Vercel Serverless Mode**: Route rewrites send requests to `api/index.js`. Schema initialization is executed lazily (`initSchemaIfNeeded`) to keep cold starts under 300ms. Quiz submissions publish to Upstash QStash cloud queue in 20ms and are delivered asynchronously to `POST /api/quiz/process-webhook`.
- **Automatic Fallback**: If QStash is unreachable or free tier limits are hit, the controller falls back to an atomic SQL `UPSERT` (`submitQuizForUser`), ensuring 0% submission loss under load.

## Load Testing Benchmarks

The project includes load scripts in `backend/scripts/load/` to stress-test candidate submissions.

| Benchmark | Total Requests | Concurrency | Success Rate | Avg Latency | System Throughput |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **QStash Burst Test** | 2,500 | 100 Sockets | **100% (202 Accepted)** | 288 ms | **341.4 Req / Sec** |
| **5,000 User Stress Test** | 5,000 | 200 Sockets | **100% (200 OK)** | 653 ms | **302.3 Req / Sec** |

See [docs/LOAD_TESTING.md](docs/LOAD_TESTING.md) for the full runbook.

## Deployment

Build the frontend and deploy the backend to Vercel (or Node host with `NODE_ENV=production`).

For security and production hardening details, see [backend/DEPLOYMENT_SECURITY.md](backend/DEPLOYMENT_SECURITY.md). Backend setup details are in [backend/README.md](backend/README.md), and frontend notes are in [frontend/README.md](frontend/README.md).
