import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { downloadBulkZip } from "../controllers/exportController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.post("/bulk-zip", asyncHandler(downloadBulkZip));

export default router;
