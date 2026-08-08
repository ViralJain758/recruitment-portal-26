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

    const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

    if (isVercel || !quizSubmitQueue) {
      const result = await submitQuizForUser(user.id, responses);
      return res.json(result);
    }

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

    return res.status(error.statusCode || 400).json({
      message: error.message || "Failed to submit quiz.",
    });
  }
}
