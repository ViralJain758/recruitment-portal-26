import Redis from "ioredis";
import dotenv from "dotenv";
import logger from "./logger.js";

dotenv.config();

let redisConnection = null;

if (process.env.REDIS_URL) {
  redisConnection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  redisConnection.on("error", (error) => {
    logger.error("Redis connection error", { error: error.message });
  });

  redisConnection.on("connect", () => {
    logger.info("Redis connected");
  });
}

export default redisConnection;
