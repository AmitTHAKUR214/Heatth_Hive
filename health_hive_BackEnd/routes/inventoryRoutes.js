import express from "express";
import multer from "multer";
import { verifyUser, requirePharmacist } from "../middleware/auth.js";
import {
  getMyInventory,
  upsertInventory,
  uploadInventoryCSV,
  getInventorySummary,
} from "../controllers/inventoryController.js";


const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ─── Shared middleware ───────────────────────────────────────────────────────
const guard = [verifyUser, requirePharmacist];

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/inventory/me
// ✅ FIX: Only one terminal controller per route
router.get("/me", ...guard, getMyInventory);

// GET /api/inventory/summary
router.get("/summary", ...guard, getInventorySummary);

// POST /api/inventory/me  (manual add/edit)
// ✅ FIX: upsertInventory IS the terminal handler — removed wrongly chained getInventorySummary
router.post("/me", ...guard, upsertInventory);

// POST /api/inventory/upload-csv
// ✅ FIX: uploadInventoryCSV IS the terminal handler — removed wrongly chained getInventorySummary
router.post(
  "/upload-csv",
  ...guard,
  upload.single("file"),
  uploadInventoryCSV
);

export default router;