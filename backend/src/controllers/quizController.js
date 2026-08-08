import {
  bearerToken,
  userFromAccessTokenPayload,
  userFromToken,
} from "../services/authService.js";
import { fetchQuizQuestionsForUser } from "../services/quizService.js";
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

export async function submitQuiz(req, res) {
  try {
    const token = bearerToken(req);
    // Keep the hot submission path Redis-first. Verifying the JWT locally
    // avoids doing hundreds/thousands of pre-queue DB reads during a slot
    // timer burst. The worker still validates the candidate/profile/slot in
    // submitQuizForUser before writing any score.
    const user = token ? userFromAccessTokenPayload(token) : null;

    if (!user) {
      return res.status(401).json({
        message: "Invalid or expired session.",
      });
    }

    const { responses = {} } = req.body || {};

    // Redis is the durable handoff. The request returns as soon as BullMQ
    // accepts the job so thousands of candidates do not keep sockets open
    // while the worker drains database writes at controlled concurrency.
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
  } catch (error) {
    (req.log || logger).error("API error", { error: error.message, stack: error.stack });

    return res.status(503).json({
      message:
        "Your submission could not be queued right now. Retrying automatically.",
    });
  }
}
