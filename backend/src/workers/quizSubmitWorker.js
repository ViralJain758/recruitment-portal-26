import { Worker, UnrecoverableError } from "bullmq";
import redisConnection from "../config/redis.js";
import { QUIZ_SUBMIT_QUEUE_NAME } from "../queues/quizSubmitQueue.js";
import { submitQuizForUser } from "../services/quizService.js";
import logger from "../config/logger.js";

// How many submissions are written to the database at once. This is the
// actual knob that prevents "heavy traffic" from overwhelming Turso: no
// matter how many hundreds of candidates hit /api/quiz/submit in the same
// second, only this many writes are ever in flight simultaneously — the
// rest wait safely in the Redis-backed queue instead of piling up as
// concurrent DB connections and timing out.
const CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.QUIZ_SUBMIT_CONCURRENCY || "50", 10),
);

// Errors that are about the *outcome* (already submitted, no slot
// assigned, candidate not found, etc.) are never going to succeed no
// matter how many times we retry them, so they're marked unrecoverable —
// BullMQ stops retrying immediately and surfaces the error right back to
// the waiting HTTP request instead of burning through all 5 attempts.
const NON_RETRYABLE_MESSAGES = [
  "already been submitted",
  "Candidate not found",
  "No quiz slot is assigned",
];

function isNonRetryable(error) {
  return NON_RETRYABLE_MESSAGES.some((fragment) =>
    (error?.message || "").includes(fragment),
  );
}

export const quizSubmitWorker = new Worker(
  QUIZ_SUBMIT_QUEUE_NAME,
  async (job) => {
    const { userId, responses } = job.data;

    try {
      return await submitQuizForUser(userId, responses);
    } catch (error) {
      if (isNonRetryable(error)) {
        throw new UnrecoverableError(error.message);
      }
      // Anything else (transient Turso/network hiccup, etc.) is left to
      // throw normally so BullMQ's retry/backoff (configured on the queue)
      // kicks in.
      throw error;
    }
  },
  {
    connection: redisConnection.duplicate(),
    concurrency: CONCURRENCY,
  },
);

quizSubmitWorker.on("failed", (job, error) => {
  logger.error("Quiz submission job failed", {
    jobId: job?.id,
    userId: job?.data?.userId,
    attemptsMade: job?.attemptsMade,
    error: error.message,
  });
});

quizSubmitWorker.on("error", (error) => {
  logger.error("Quiz submit worker error", { error: error.message });
});

export async function closeQuizSubmitWorker() {
  await quizSubmitWorker.close();
}
