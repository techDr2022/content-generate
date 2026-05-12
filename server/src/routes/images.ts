import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { generateImageFromCalendarText } from "../controllers/imageGenController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.post("/generate", asyncHandler(generateImageFromCalendarText));

export default router;
