import {
  bearerToken,
  userFromAccessTokenPayload,
  userFromToken,
} from "../services/authService.js";
import { fetchQuizQuestionsForUser, submitQuizForUser } from "../services/quizService.js";
import {
  quizSubmitQueue,
  quizSubmitJobId,
} from "../queues/quizSubmitQueue.js";
import logger from "../config/logger.js";

export async function getQuizQuestions(req, res) {
  try {
    const token = bearerToken(req);
    const user = token ? await userFromToken(token) : null;

    if (!user) {
      return res.status(401).json({
        message: "Invalid or expired session.",
      });
    }

    const { questions, slot } = await fetchQuizQuestionsForUser(user.id);

    return res.json({ questions, slot });
  } catch (error) {
    (req.log || logger).error("API error", { error: error.message, stack: error.stack });
    return res.status(400).json({
      message: error.message || "Failed to load quiz questions.",
    });
  }
}

import { qstashClient, qstashReceiver } from "../config/qstash.js";

export async function submitQuiz(req, res) {
  try {
    const token = bearerToken(req);
    let user = token ? userFromAccessTokenPayload(token) : null;
    if (!user && token) {
      user = await userFromToken(token);
    }

    if (!user) {
      return res.status(401).json({
        message: "Invalid or expired session.",
      });
    }

    const { responses = {} } = req.body || {};

    // 1. Upstash QStash Serverless Queueing (Recommended for Vercel / Edge)
    if (qstashClient) {
      const canonicalHost = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
      let targetUrl = "";
      if (canonicalHost) {
        targetUrl = canonicalHost.startsWith("http")
          ? `${canonicalHost}/api/quiz/process-webhook`
          : `https://${canonicalHost}/api/quiz/process-webhook`;
      } else {
        const reqHost = (process.env.VERCEL_URL || req.get("host") || "").replace(/\/$/, "");
        targetUrl = reqHost.startsWith("http")
          ? `${reqHost}/api/quiz/process-webhook`
          : `https://${reqHost}/api/quiz/process-webhook`;
      }

      logger.info("Publishing quiz submission to QStash", { userId: user.id, targetUrl });

      const qstashRes = await qstashClient.publishJSON({
        url: targetUrl,
        body: { userId: user.id, responses },
        deduplicationId: `quiz-submit-${user.id}`,
        retries: 3,
      });

      return res.status(202).json({
        queued: true,
        submitted: true,
        messageId: qstashRes.messageId,
        message: "Quiz submission queued successfully.",
      });
    }

    // 2. BullMQ Redis Queue (for standalone Node servers)
    if (quizSubmitQueue) {
      const job = await quizSubmitQueue.add(
        "submit",
        { userId: user.id, responses },
        { jobId: quizSubmitJobId(user.id) },
      );

      return res.status(202).json({
        queued: true,
        submitted: true,
        jobId: job.id,
        message: "Quiz submission accepted for processing.",
      });
    }

    // 3. Direct DB submission fallback
    const result = await submitQuizForUser(user.id, responses);
    return res.json(result);
  } catch (error) {
    (req.log || logger).error("API error", { error: error.message, stack: error.stack });

    return res.status(error.statusCode || 400).json({
      message: error.message || "Failed to submit quiz.",
    });
  }
}

export async function processQuizWebhook(req, res) {
  try {
    if (qstashReceiver) {
      const signature = req.headers["upstash-signature"];
      const rawBody = req.rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));

      const isValid = await qstashReceiver
        .verify({
          signature,
          body: rawBody,
        })
        .catch((err) => {
          logger.warn("QStash signature verification exception", { error: err.message });
          return false;
        });

      if (!isValid) {
        logger.warn("Rejecting webhook due to invalid QStash signature", {
          path: req.originalUrl,
          hasSignature: Boolean(signature),
        });
        return res.status(401).json({ message: "Invalid QStash signature" });
      }
    }

    const payload = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.rawBody || "{}");
    const { userId, responses } = payload || {};

    if (!userId) {
      logger.warn("QStash webhook payload missing userId", { payload });
      return res.status(400).json({ message: "userId is required" });
    }

    logger.info("Processing quiz submission from QStash webhook", { userId });
    const result = await submitQuizForUser(userId, responses);
    logger.info("Successfully processed quiz submission to database via QStash", {
      userId,
      score: result.score,
    });

    return res.status(200).json({ success: true, result });
  } catch (error) {
    (req.log || logger).error("Webhook error processing quiz submission", {
      error: error.message,
      stack: error.stack,
    });

    if (/already|submitted/i.test(error.message || "")) {
      return res.status(200).json({ success: true, message: error.message });
    }

    return res.status(500).json({ message: error.message });
  }
}
