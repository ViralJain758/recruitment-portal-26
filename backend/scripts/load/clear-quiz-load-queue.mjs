import { quizSubmitQueue, quizSubmitQueueEvents } from "../../src/queues/quizSubmitQueue.js";
import redisConnection from "../../src/config/redis.js";

await quizSubmitQueue.obliterate({ force: true });

await quizSubmitQueueEvents.close();
await quizSubmitQueue.close();
await redisConnection.quit();

console.log("Cleared quiz-submit BullMQ queue.");

process.exit(0);
