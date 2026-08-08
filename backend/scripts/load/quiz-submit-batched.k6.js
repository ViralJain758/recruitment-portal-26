import http from "k6/http";
import { check } from "k6";
import exec from "k6/execution";
import { sleep } from "k6";
import { Counter } from "k6/metrics";

const baseUrl = __ENV.BASE_URL || "http://localhost:5001";
const tokenFile = __ENV.TOKENS_FILE || "quiz-load-users.json";
const loadTestToken = __ENV.LOAD_TEST_BYPASS_TOKEN || "";
const users = JSON.parse(open(tokenFile));
const batchSize = Number(__ENV.BATCH_SIZE || 50);
const maxAttempts = Number(__ENV.MAX_ATTEMPTS || 6);
const retryDelaySeconds = Number(__ENV.RETRY_DELAY_SECONDS || 0.25);
const batchDelaySeconds = Number(__ENV.BATCH_DELAY_SECONDS || 0);
const batchCount = Math.ceil(users.length / batchSize);

export const successfulSubmissions = new Counter("successful_submissions");
export const failedSubmissions = new Counter("failed_submissions");
export const retriedSubmissions = new Counter("retried_submissions");

export const options = {
  batch: batchSize,
  batchPerHost: batchSize,
  scenarios: {
    quiz_submission_batches: {
      executor: "shared-iterations",
      vus: 1,
      iterations: batchCount,
      maxDuration: __ENV.MAX_DURATION || "5m",
    },
  },
  thresholds: {
    checks: ["rate>0.95"],
    failed_submissions: ["count==0"],
    successful_submissions: [`count==${users.length}`],
  },
};

function responses() {
  const answers = {};
  for (let i = 1; i <= 15; i += 1) {
    answers[`load-test-question-${i}`] = 0;
  }
  return answers;
}

function isAlreadySubmitted(res) {
  return (
    res.status === 400 &&
    typeof res.body === "string" &&
    res.body.includes("already been submitted")
  );
}

function isAccepted(res) {
  return res.status === 200 || res.status === 202 || isAlreadySubmitted(res);
}

function shouldRetry(res) {
  return res.status === 0 || res.status >= 500;
}

function requestFor(user, attempt) {
  return [
    "POST",
    `${baseUrl}/api/quiz/submit`,
    JSON.stringify({ responses: responses() }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.token}`,
        ...(loadTestToken ? { "x-load-test-token": loadTestToken } : {}),
      },
      timeout: __ENV.REQUEST_TIMEOUT || "20s",
      tags: { endpoint: "quiz_submit", attempt: String(attempt) },
    },
  ];
}

export default function () {
  const batchIndex = exec.scenario.iterationInTest;
  const start = batchIndex * batchSize;
  const batchUsers = users.slice(start, start + batchSize);
  let pending = batchUsers;

  for (let attempt = 1; attempt <= maxAttempts && pending.length > 0; attempt += 1) {
    const responsesForAttempt = http.batch(
      pending.map((user) => requestFor(user, attempt)),
    );
    const retry = [];

    responsesForAttempt.forEach((res, index) => {
      const user = pending[index];
      const ok = check(res, {
        "accepted by API": (r) => isAccepted(r),
        "not rate limited": (r) => r.status !== 429,
        "not unauthorized": (r) => r.status !== 401,
      });

      if (isAccepted(res)) {
        successfulSubmissions.add(1);
        return;
      }

      if (shouldRetry(res) && attempt < maxAttempts) {
        retry.push(user);
        return;
      }

      failedSubmissions.add(1);
      if (!ok) {
        console.error(`submission failed for ${user.email}: status=${res.status} body=${res.body}`);
      }
    });

    if (retry.length > 0) {
      retriedSubmissions.add(retry.length);
      sleep(retryDelaySeconds);
    }

    pending = retry;
  }

  if (batchDelaySeconds > 0) sleep(batchDelaySeconds);
}
