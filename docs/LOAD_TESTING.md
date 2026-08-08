# Quiz Submission Load Testing

This runbook verifies that the quiz submission architecture (Upstash QStash, Turso DB, Express) accepts and processes high-concurrency bursts of candidate submissions.

Run tests against local or dedicated staging infrastructure. The seed script creates disposable candidates with the `loadtest-` prefix.

## High-Capacity 2,500 to 5,000 Candidate Stress Test

1. Seed 2,500 candidate test accounts and tokens:

```powershell
$env:LOAD_TEST_CANDIDATES = "2500"
node scripts/load/seed-quiz-load-test.mjs
```

2. Start the backend server:

```powershell
$env:PORT = "5000"
$env:LOAD_TEST_BYPASS_TOKEN = "load-test-bypass-secret-123"
node server.js
```

3. Execute the load test with 100 parallel worker sockets:

```powershell
$env:LOAD_TEST_CONCURRENCY = "100"
node scripts/load/run-load-test.mjs
```

4. Verify WebSocket connectivity and Socket.IO authentication:

```powershell
node scripts/test-websocket.mjs
```

## Benchmark Results

| Scenario | Total Candidates | Concurrency | Success Rate | Avg Latency | Throughput |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **QStash Cloud Queue** | 2,500 Users | 100 Sockets | **100% (202 Accepted)** | 288 ms | **341.4 Req / Sec** |
| **Direct DB Stress Test** | 5,000 Users | 200 Sockets | **100% (200 OK)** | 653 ms | **302.3 Req / Sec** |

## Passing Criteria

The test passes when all of the following are true:

- `Successful` count equals total candidates.
- `Failed / Errored` count is `0`.
- Database query confirms all candidate submissions exist in `candidate_quiz`.

`scripts/load/quiz-load-users.json` is generated test data and is intentionally ignored by Git.
