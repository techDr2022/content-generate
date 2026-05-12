import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import {
  listJobs,
  getJob,
  streamJobs,
  streamJobProgress,
  downloadJob,
  regenerateJob,
  previewJobCalendar,
  cancelJob,
} from "../controllers/jobController";
import { requireAuth } from "../middleware/auth";
import { authenticateSse } from "../middleware/sseAuth";

const router = Router();

router.get("/stream", authenticateSse, asyncHandler(streamJobs));
router.get("/:id/progress", authenticateSse, asyncHandler(streamJobProgress));

router.use(requireAuth);

router.get("/", asyncHandler(listJobs));
router.get("/:id/download", asyncHandler(downloadJob));
router.get("/:id/preview", asyncHandler(previewJobCalendar));
router.post("/:id/regenerate", asyncHandler(regenerateJob));
router.post("/:id/cancel", asyncHandler(cancelJob));
router.get("/:id", asyncHandler(getJob));

export default router;
