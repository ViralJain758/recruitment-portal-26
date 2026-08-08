import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import db from "../../src/config/db.js";

const tokensFile = path.resolve("scripts/load/quiz-load-users.json");
const targetUrl = process.env.LOAD_TEST_TARGET_URL || "http://localhost:5000/api/quiz/submit";

async function run() {
  console.log("Starting Load Test Execution...");

  const fileContent = await fs.readFile(tokensFile, "utf8");
  const candidates = JSON.parse(fileContent);

  console.log(`Loaded ${candidates.length} candidate user tokens for test.`);

  const sampleResponses = {
    "load-test-question-1": 0,
    "load-test-question-2": 0,
    "load-test-question-3": 0,
  };

  const results = [];
  const startTime = Date.now();

  console.log(`Firing ${candidates.length} SIMULTANEOUS requests to ${targetUrl}...`);

  const requests = candidates.map(async (candidate, index) => {
    const reqStart = Date.now();
    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${candidate.token}`,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LoadTestRunner/1.0",
          "x-load-test-token": "load-test-bypass-secret-123",
        },
        body: JSON.stringify({ responses: sampleResponses }),
      });

      const durationMs = Date.now() - reqStart;
      const data = await res.json().catch(() => ({}));

      return {
        index: index + 1,
        status: res.status,
        durationMs,
        ok: res.ok,
        message: data.message || null,
        queued: data.queued ?? false,
        messageId: data.messageId ?? null,
      };
    } catch (err) {
      const durationMs = Date.now() - reqStart;
      return {
        index: index + 1,
        status: 0,
        error: err.message,
        durationMs,
        ok: false,
      };
    }
  });

  const responses = await Promise.all(requests);
  const totalTime = Date.now() - startTime;

  // Analysis
  const durations = responses.map((r) => r.durationMs).sort((a, b) => a - b);
  const statusCounts = {};
  let successCount = 0;
  let errorCount = 0;
  let queuedCount = 0;

  responses.forEach((r) => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    if (r.ok) successCount += 1;
    else errorCount += 1;
    if (r.queued) queuedCount += 1;
  });

  const min = durations[0];
  const max = durations[durations.length - 1];
  const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  const p50 = durations[Math.floor(durations.length * 0.5)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const p99 = durations[Math.floor(durations.length * 0.99)];

  console.log("\n==========================================");
  console.log("          LOAD TEST RESULTS SUMMARY       ");
  console.log("==========================================");
  console.log(`Total Requests Sent : ${candidates.length}`);
  console.log(`Total Elapsed Time   : ${totalTime} ms`);
  console.log(`Successful (200/202): ${successCount}`);
  console.log(`Queued to QStash    : ${queuedCount}`);
  console.log(`Failed / Errored    : ${errorCount}`);
  console.log("------------------------------------------");
  console.log("Status Code Distribution:");
  Object.entries(statusCounts).forEach(([code, count]) => {
    console.log(`  HTTP ${code} : ${count} requests`);
  });
  const firstError = responses.find((r) => !r.ok);
  if (firstError) {
    console.log(`Sample Error Message: "${firstError.message || firstError.error}"`);
  }
  console.log("------------------------------------------");
  console.log("Latency Stats:");
  console.log(`  Min Latency : ${min} ms`);
  console.log(`  Avg Latency : ${avg} ms`);
  console.log(`  p50 Latency : ${p50} ms`);
  console.log(`  p95 Latency : ${p95} ms`);
  console.log(`  p99 Latency : ${p99} ms`);
  console.log(`  Max Latency : ${max} ms`);
  console.log("==========================================\n");
}

run().catch(console.error);
