import express from "express";
import {
  login,
  me,
  refresh,
  saveCandidateDetails,
  signup,
  verifyAdminOtp,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/admin-verify-otp", verifyAdminOtp);
router.post("/refresh", refresh);
router.post("/candidate-details", saveCandidateDetails);
router.get("/me", me);

export default router;
