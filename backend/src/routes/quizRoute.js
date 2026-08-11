import express from "express";
import { getQuizQuestions, submitQuiz, autosaveQuiz, processQuizWebhook } from "../controllers/quizController.js";
import { quizLimiter, quizSubmitLimiter, quizAutosaveLimiter } from "../middleware/rateLimiters.js";
import { blockKnownBots, slowDown } from "../middleware/botProtection.js";

const router = express.Router();

router.get("/questions", blockKnownBots, slowDown("quiz_questions"), quizLimiter, getQuizQuestions);
router.post("/submit", blockKnownBots, slowDown("quiz_submit"), quizSubmitLimiter, submitQuiz);
router.post("/autosave", blockKnownBots, quizAutosaveLimiter, autosaveQuiz);
router.post("/process-webhook", processQuizWebhook);

export default router;
