import express from "express";
import {
  sendOTP,
  verifyOTPAndComplete,
  checkVerificationStatus,
} from "../controllers/otpController.js";
import { otpLimiter } from "../middleware/rateLimiters.js";
import { blockKnownBots, slowDown } from "../middleware/botProtection.js";

const router = express.Router();

router.post("/send-otp", blockKnownBots, slowDown("send_otp"), otpLimiter, sendOTP);
router.post(
  "/verify-and-complete",
  blockKnownBots,
  slowDown("verify_otp"),
  otpLimiter,
  verifyOTPAndComplete,
);
router.get("/check-verification", otpLimiter, checkVerificationStatus);

export default router;
