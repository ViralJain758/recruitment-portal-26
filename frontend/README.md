# Recruitment Portal Frontend

The frontend is a React 19 application built with Vite. It provides the candidate, administrator, scanner, and exam interfaces.

## Setup

```powershell
npm install
$env:VITE_API_BASE_URL = "http://localhost:5000"
npm run dev
```

Use `npm run build` to create a production bundle and `npm run preview` to check that bundle locally. `npm run lint` runs the configured lint checks.

## Environment

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Base URL of the Express API, for example `http://localhost:5000`. |

Values prefixed with `VITE_` are exposed to the browser. Never put passwords, database tokens, SMTP credentials, or JWT secrets in frontend environment variables.

## Main routes

| Route | Purpose |
| --- | --- |
| `/signup`, `/otp`, `/login` | Candidate authentication and verification. |
| `/candidate-details` | Candidate profile completion. |
| `/dashboard` | Candidate status and portal dashboard. |
| `/instruction` | Exam instructions before a quiz. |
| `/quiz` | Protected quiz attempt. |
| `/result` | Quiz result and submission status. |
| `/admin-dashboard` | Administrator operations. |
| `/scanner` | Attendance scanner. |
| `/privacy-policy` | Privacy policy. |

Candidate routes require a valid session. Dashboard and exam routes also require a completed candidate profile. Administrator access is handled separately from the candidate flow.

## Submission behavior

When a candidate completes a quiz, the frontend sends the submission to the API. A `202 Accepted` response means Redis accepted the queue job; the backend worker completes the database write. The result screen keeps the user informed while a submission is pending and may retry transient transport failures.

## Local development notes

- Keep the API running before using the frontend.
- Configure the backend `CLIENT_ORIGIN` to allow the Vite development origin.
- Socket.IO uses the same API base URL, so an incorrect `VITE_API_BASE_URL` can break live updates as well as API requests.
- The scanner depends on browser camera permission and works best over HTTPS outside localhost.

See the repository [README](/D:/Projects/MERN/recruitment-portal-26/README.md) for system setup and [backend/README.md](/D:/Projects/MERN/recruitment-portal-26/backend/README.md) for API and service configuration.
