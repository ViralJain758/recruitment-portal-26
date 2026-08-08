import Redis from "ioredis";
import dotenv from "dotenv";
import logger from "./logger.js";

dotenv.config();

if (!process.env.REDIS_URL) {
  throw new Error("Missing REDIS_URL in environment variables.");
}

// A single shared connection, reused by the quiz-submit Queue, QueueEvents,
// and Worker (BullMQ recommends one dedicated connection per of those
// three roles in production, but a single ioredis client with
// `maxRetriesPerRequest: null` — required by BullMQ — is enough here and
// keeps things simple for this app's traffic volume).
//
// `enableReadyCheck`/`maxRetriesPerRequest: null` are BullMQ requirements:
// without them, BullMQ's internal blocking commands (used by the worker to
// wait for new jobs) can throw instead of retrying indefinitely.
const redisConnection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redisConnection.on("error", (error) => {
  logger.error("Redis connection error", { error: error.message });
});

redisConnection.on("connect", () => {
  logger.info("Redis connected");
});

export default redisConnection;
