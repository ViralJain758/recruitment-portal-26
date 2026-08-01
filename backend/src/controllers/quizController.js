import { bearerToken, userFromToken } from "../services/authService.js";
import { fetchQuizQuestionsForUser, submitQuizForUser } from "../services/quizService.js";
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
    const user = token ? await userFromToken(token) : null;

    if (!user) {
      return res.status(401).json({
        message: "Invalid or expired session.",
      });
    }

    const { responses = {} } = req.body || {};
    const result = await submitQuizForUser(user.id, responses);

    return res.json(result);
  } catch (error) {
    (req.log || logger).error("API error", { error: error.message, stack: error.stack });
    return res.status(400).json({
      message: error.message || "Failed to submit quiz.",
    });
  }
}
