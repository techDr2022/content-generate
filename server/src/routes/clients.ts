import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getClientHistory,
} from "../controllers/clientController";
import { suggestServices } from "../controllers/suggestServicesController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(listClients));
router.post("/suggest-services", asyncHandler(suggestServices));
router.post("/", asyncHandler(createClient));
router.get("/:id", asyncHandler(getClient));
router.put("/:id", asyncHandler(updateClient));
router.delete("/:id", asyncHandler(deleteClient));
router.get("/:id/history", asyncHandler(getClientHistory));

export default router;
