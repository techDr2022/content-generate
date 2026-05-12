import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { enqueueGenerate, enqueueBulkGenerate } from "../controllers/generateController";
import { suggestSpecialDays } from "../controllers/suggestSpecialDaysController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.post("/", asyncHandler(enqueueGenerate));
router.post("/bulk", asyncHandler(enqueueBulkGenerate));
router.post("/suggest-special-days", asyncHandler(suggestSpecialDays));

export default router;
