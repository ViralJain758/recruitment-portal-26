import {
  bearerToken,
  userFromAccessTokenPayload,
  userFromToken,
} from "../services/authService.js";
import {
  fetchQuizQuestionsForUser,
  submitQuizForUser,
  autosaveQuizAnswersForUser,
} from "../services/quizService.js";
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

// Lightweight, frequent, best-effort. Never lets the client's exam flow
// stall on this: failures come back as a normal error response (so the
// client's retry/backoff logic can decide what to do) but nothing here is
// destructive or blocks the candidate from continuing the quiz.
export async function autosaveQuiz(req, res) {
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
    const result = await autosaveQuizAnswersForUser(user.id, responses);

    return res.status(200).json({ saved: true, count: result.saved });
  } catch (error) {
    (req.log || logger).error("API error", { error: error.message, stack: error.stack });
    return res.status(error.statusCode || 400).json({
      message: error.message || "Failed to autosave answers.",
    });
  }
}

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

    // 1. Primary Direct DB Write — Guaranteed atomic score & status update in Turso
    const result = await submitQuizForUser(user.id, responses);

    // 2. Async QStash Queueing for background event logging / auditing (fire & forget)
    if (qstashClient) {
      try {
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

        const isLoopback = /localhost|127\.0\.0\.1|::1/i.test(targetUrl);

        if (!isLoopback) {
          qstashClient
            .publishJSON({
              url: targetUrl,
              body: { userId: user.id, responses },
              deduplicationId: `quiz-submit-${user.id}`,
              retries: 3,
            })
            .catch((err) => {
              logger.warn("Async QStash publish failed", { error: err.message });
            });
        }
      } catch (err) {
        logger.warn("QStash background publishing exception", { error: err.message });
      }
    }

    return res.status(200).json({
      submitted: true,
      score: result.score,
      totalQuestions: result.totalQuestions,
      message: "Quiz submitted successfully.",
    });
  } catch (error) {
    (req.log || logger).error("API error", { error: error.message, stack: error.stack });

    if (/already|submitted/i.test(error.message || "")) {
      return res.status(200).json({
        submitted: true,
        message: error.message || "This quiz has already been submitted.",
      });
    }

    return res.status(error.statusCode || 400).json({
      message: error.message || "Failed to submit quiz.",
    });
  }
}

export async function processQuizWebhook(req, res) {
  try {
    const payload = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.rawBody || "{}");
    const { userId, responses } = payload || {};

    if (!userId) {
      logger.warn("QStash webhook payload missing userId", { payload });
      return res.status(400).json({ message: "userId is required" });
    }

    logger.info("Processing quiz submission from QStash webhook", { userId });
    const result = await submitQuizForUser(userId, responses).catch((err) => {
      if (/already|submitted/i.test(err.message || "")) {
        return { submitted: true, message: err.message };
      }
      throw err;
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
