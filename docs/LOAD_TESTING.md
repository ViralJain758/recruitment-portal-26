# Quiz Submission Load Testing

This runbook verifies that Redis and the quiz submission worker can accept and process a burst of candidate quiz submissions.

Run it only against local or dedicated staging infrastructure. The seed script creates disposable candidates with the `loadtest-` prefix. Do not send the bypass token to a browser or use it on a public production endpoint.

## Prerequisites

- Backend dependencies installed.
- `backend/.env` points to a non-production test database and a reachable Redis instance.
- k6 is installed and available as `k6`.
- The test server can receive requests on its selected port.

## Recommended 1,500-candidate test

Open a terminal in `backend` and run the following in order.

1. Clear any previous test queue entries.

```powershell
node scripts/load/clear-quiz-load-queue.mjs
```

2. Create 1,500 dummy candidates.

```powershell
node scripts/load/seed-quiz-load-test.mjs --count 1500
```

3. Start an isolated backend instance. Keep this terminal running.

```powershell
$env:PORT = "5001"
$env:LOAD_TEST_BYPASS_TOKEN = "replace-with-a-long-random-test-token"
$env:LOG_LEVEL = "warn"
node server.js
```

4. In a second `backend` terminal, send 50 submissions at once per wave.

```powershell
$env:BASE_URL = "http://localhost:5001"
$env:LOAD_TEST_BYPASS_TOKEN = "replace-with-a-long-random-test-token"
$env:TOTAL_SUBMISSIONS = "1500"
$env:BATCH_SIZE = "50"
k6 run scripts/load/quiz-submit-batched.k6.js
```

5. Confirm that the worker drained the queue and wrote every result.

```powershell
node scripts/load/quiz-load-status.mjs
```

## Instant burst test

Use this only when you explicitly want to test the host's ability to accept 1,500 connections at the same moment. A small amount of transport retry can be normal on a developer machine; the batched test is the meaningful Redis processing benchmark.

```powershell
$env:BASE_URL = "http://localhost:5001"
$env:LOAD_TEST_BYPASS_TOKEN = "replace-with-a-long-random-test-token"
$env:TOTAL_SUBMISSIONS = "1500"
k6 run scripts/load/quiz-submit-instant.k6.js
```

## Passing result

The test passes when all of the following are true:

- `successful_submissions` is `1500`.
- `failed_submissions` is `0`.
- `quiz-load-status.mjs` reports no failed queue jobs and `1500` persisted quiz submissions.
- Queue depth reaches zero after the worker catches up.

For the 50-at-once test, retry counts should be close to zero. A high `http_req_failed` value during the all-at-once script typically indicates client connection retries or an overloaded HTTP accept path, not necessarily a Redis failure. Verify the final queue and database state before diagnosing Redis.

## Tuning guide

| Setting | Effect |
| --- | --- |
| `BATCH_SIZE` | Number of concurrent HTTP submissions per k6 wave. Keep at `50` for the standard benchmark. |
| `QUIZ_SUBMIT_CONCURRENCY` | Number of quiz jobs processed concurrently by BullMQ. Start at `50`. |
| `TOTAL_SUBMISSIONS` | Number of seeded candidates and expected successful submissions. |
| k6 retry settings | Control how aggressively a temporary transport failure is repeated. Fewer retries make latency clearer, but can undercount recoverable requests. |

Increase worker concurrency only after confirming that Turso write latency remains stable. The queue protects the API from a burst; it does not make the database unlimited.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `503` from quiz submit | Confirm Redis is reachable from the backend and inspect the backend error log. |
| High retries but all submissions persist | Use the 50-at-once script, confirm the bypass token matches, and check host CPU and open connection limits. |
| Jobs remain queued | Confirm the backend process started the quiz worker and that `QUIZ_SUBMIT_CONCURRENCY` is greater than zero. |
| Missing persisted submissions | Run `quiz-load-status.mjs`, inspect failed jobs, and confirm test candidates were seeded against the same database used by the backend. |

`scripts/load/quiz-load-users.json` is generated test data and is intentionally ignored by Git.
