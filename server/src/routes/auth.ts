import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { register, login, me, changePassword } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimiter";

const router = Router();

router.post("/register", authLimiter, asyncHandler(register));
router.post("/login", authLimiter, asyncHandler(login));
router.post("/change-password", requireAuth, authLimiter, asyncHandler(changePassword));
router.get("/me", requireAuth, asyncHandler(me));

export default router;
