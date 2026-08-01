import express from "express";
import { getQuizQuestions, submitQuiz } from "../controllers/quizController.js";
import { quizLimiter, quizSubmitLimiter } from "../middleware/rateLimiters.js";
import { blockKnownBots, slowDown } from "../middleware/botProtection.js";

const router = express.Router();

router.get("/questions", blockKnownBots, slowDown("quiz_questions"), quizLimiter, getQuizQuestions);
router.post("/submit", blockKnownBots, slowDown("quiz_submit"), quizSubmitLimiter, submitQuiz);

export default router;
