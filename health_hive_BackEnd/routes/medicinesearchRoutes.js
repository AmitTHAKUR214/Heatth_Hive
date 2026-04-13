import express from "express";
import { searchMedicines } from "../controllers/medicineSearchController.js";

const router = express.Router();

router.get("/medicines", searchMedicines);

export default router;