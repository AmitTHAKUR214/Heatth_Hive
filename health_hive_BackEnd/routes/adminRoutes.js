import express from "express";
import { verifyAdmin } from "../middleware/auth.js";
import * as admin from "../controllers/adminController.js";

const router = express.Router();

router.get   ("/stats",                                verifyAdmin, admin.getStats);

// Pharmacists
router.get   ("/pharmacists",                          verifyAdmin, admin.getPharmacists);
router.get   ("/pharmacist/:id",                       verifyAdmin, admin.getPharmacist);
router.patch ("/pharmacists/:id/approve",              verifyAdmin, admin.approvePharmacist);
router.patch ("/pharmacists/:id/reject",               verifyAdmin, admin.rejectPharmacist);
router.patch ("/pharmacists/:id/request-reverification", verifyAdmin, admin.requestPharmacistReverification);
router.patch ("/pharmacist/:pharmacyId/document",      verifyAdmin, admin.updatePharmacistDocument);

// Users
router.get   ("/users",                                verifyAdmin, admin.getUsers);
router.patch ("/users/:id/ban",                        verifyAdmin, admin.banUser);
router.patch ("/users/:id/unban",                      verifyAdmin, admin.unbanUser);
router.delete("/users/:id",                            verifyAdmin, admin.deleteUser);

// Doctors
router.get   ("/doctors",                              verifyAdmin, admin.getDoctors);
router.get   ("/doctor/:id",                           verifyAdmin, admin.getDoctor);
router.patch ("/doctors/:id/approve",                  verifyAdmin, admin.approveDoctor);
router.patch ("/doctors/:id/reject",                   verifyAdmin, admin.rejectDoctor);
router.patch ("/doctors/:id/request-reverification",   verifyAdmin, admin.requestDoctorReverification);
router.patch ("/doctor/:doctorId/document",            verifyAdmin, admin.updateDoctorDocument);

export default router;