import express from "express";
import multer from "multer";
import { verifyUser, requirePharmacist } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import * as pharmacist from "../controllers/pharmacistController.js";

const router = express.Router();
const guard  = [verifyUser, requirePharmacist];
const docFields = upload.fields([
  { name: "pharmacyLicense", maxCount: 1 },
  { name: "ownerIdProof",    maxCount: 1 },
  { name: "gstCertificate",  maxCount: 1 },
]);

router.get   ("/shop",           ...guard,              pharmacist.getShop);
router.post  ("/shop",           ...guard,              pharmacist.createOrUpdateShop);
router.patch ("/shop",           ...guard,              pharmacist.updateShop);
router.post  ("/shop/documents", ...guard, docFields,   pharmacist.uploadDocuments);

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ message: err.message });
  if (err.message === "Invalid file type") return res.status(400).json({ message: "Invalid file type" });
  next(err);
});

export default router;