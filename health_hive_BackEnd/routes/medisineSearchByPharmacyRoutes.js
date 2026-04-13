// routes/publicPharmacy.routes.js
import express from "express";
import { searchPharmaciesByMedicine } from "../controllers/searchPharmaciesByMedicineController.js";

const router = express.Router();

router.get("/search", searchPharmaciesByMedicine);

export default router;