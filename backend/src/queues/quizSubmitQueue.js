import { Queue, QueueEvents } from "bullmq";
import redisConnection from "../config/redis.js";

export const QUIZ_SUBMIT_QUEUE_NAME = "quiz-submit";

// How long the HTTP request will wait for its job to finish before giving
// up on it (the job itself keeps running/retrying in the background either
// way — this only controls how long the candidate's browser tab waits).
// All quiz submissions funnel through this queue instead of hitting the
// database directly from the request handler. That gives us two things a
// plain `await submitQuizForUser(...)` can't:
//
//   1. Backpressure: when hundreds of candidates submit within the same
//      minute (a real pattern here — everyone's exam timer ends together),
//      the queue absorbs the burst and a worker (see quizSubmitWorker.js)
//      drains it at a controlled concurrency instead of firing hundreds of
//      simultaneous writes at Turso and having a chunk of them time out.
//   2. Automatic retries: a job that fails because of a transient DB/network
//      blip is retried with backoff instead of the candidate just seeing a
//      failed submission.
export const quizSubmitQueue = new Queue(QUIZ_SUBMIT_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 500,
    },
    // Jobs are small (a userId + a responses object) and submissions are
    // rare-but-bursty, so keeping a short history is enough to debug a bad
    // run without letting Redis memory grow unbounded.
    removeOnComplete: { count: 1000, age: 24 * 60 * 60 },
    removeOnFail: { count: 1000, age: 7 * 24 * 60 * 60 },
  },
});

// During a same-second slot submission burst, many HTTP handlers can be
// waiting on the same Queue instance. BullMQ is fine with that, but Node's
// default EventEmitter listener warning is tuned for smaller fan-outs.
quizSubmitQueue.setMaxListeners(0);

// Dedicated connection for listening to job completion/failure events —
// BullMQ requires QueueEvents to have its own connection separate from the
// Queue/Worker ones since it blocks on a Redis stream.
export const quizSubmitQueueEvents = new QueueEvents(QUIZ_SUBMIT_QUEUE_NAME, {
  connection: redisConnection.duplicate(),
});
quizSubmitQueueEvents.setMaxListeners(0);

// One job per candidate at a time: if a duplicate request lands while an
// earlier one for the same candidate is still queued/active (double-clicked
// submit button, a flaky network causing the browser to retry, two open
// tabs), BullMQ will not enqueue a second job for the same jobId — it
// simply hands back the existing job, and both HTTP requests end up
// awaiting the same underlying submission instead of racing each other.
// Note: no colon in this id — BullMQ only allows a custom jobId to contain
// ':' if it has exactly 3 colon-separated segments (a legacy convention
// from repeatable jobs); anything else throws "Custom Id cannot contain :".
export function quizSubmitJobId(userId) {
  return `quiz-submit-${userId}`;
}
