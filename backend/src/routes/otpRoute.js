import express from "express";
import {
  sendOTP,
  verifyOTPAndComplete,
  checkVerificationStatus,
} from "../controllers/otpController.js";

const router = express.Router();

router.post("/send-otp", sendOTP);
router.post("/verify-and-complete", verifyOTPAndComplete);
router.get("/check-verification", checkVerificationStatus);

export default router;