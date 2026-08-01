import express from "express";
import {
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  resetPassword,
  saveCandidateDetails,
  signup,
  verifyAdminOtp,
} from "../controllers/authController.js";
import {
  authLimiter,
  candidateDetailsLimiter,
  passwordResetLimiter,
  refreshLimiter,
  signupLimiter,
} from "../middleware/rateLimiters.js";
import { blockKnownBots, slowDown } from "../middleware/botProtection.js";

const router = express.Router();

router.post("/signup", blockKnownBots, slowDown("signup"), signupLimiter, signup);
router.post("/login", blockKnownBots, slowDown("login"), authLimiter, login);
router.post("/admin-verify-otp", authLimiter, verifyAdminOtp);
router.post("/refresh", refreshLimiter, refresh);
router.post("/logout", logout);
router.post("/forgot-password", blockKnownBots, slowDown("forgot_password"), passwordResetLimiter, forgotPassword);
router.post("/reset-password", passwordResetLimiter, resetPassword);
router.post(
  "/candidate-details",
  blockKnownBots,
  slowDown("candidate_details"),
  candidateDetailsLimiter,
  saveCandidateDetails,
);
router.get("/me", me);

export default router;
