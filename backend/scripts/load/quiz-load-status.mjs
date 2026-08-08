import "dotenv/config";
import Redis from "ioredis";
import db from "../../src/config/db.js";

const emailDomain = process.env.LOAD_TEST_EMAIL_DOMAIN || "loadtest.local";
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

async function countKey(key, command) {
  const exists = await redis.exists(key);
  if (!exists) return 0;
  return Number(await redis[command](key));
}

const counts = {
  waiting: await countKey("bull:quiz-submit:wait", "llen"),
  active: await countKey("bull:quiz-submit:active", "llen"),
  completedRetained: await countKey("bull:quiz-submit:completed", "zcard"),
  failed: await countKey("bull:quiz-submit:failed", "zcard"),
  delayed: await countKey("bull:quiz-submit:delayed", "zcard"),
  events: await countKey("bull:quiz-submit:events", "xlen"),
  nextJobId: Number((await redis.get("bull:quiz-submit:id")) || 0),
};

const submitted = await db.execute({
  sql: `SELECT COUNT(*) AS count
        FROM candidate_profiles cp
        JOIN candidate_quiz cq ON cq.candidate_id = cp.id
        WHERE cp.email LIKE ?
          AND cq.quiz_submitted_at IS NOT NULL`,
  args: [`loadtest-%@${emailDomain}`],
});

const total = await db.execute({
  sql: "SELECT COUNT(*) AS count FROM candidate_profiles WHERE email LIKE ?",
  args: [`loadtest-%@${emailDomain}`],
});

console.log(JSON.stringify({
  redisJobCounts: counts,
  database: {
    submitted: Number(submitted.rows[0]?.count || 0),
    totalLoadTestCandidates: Number(total.rows[0]?.count || 0),
  },
}, null, 2));

await redis.quit();
