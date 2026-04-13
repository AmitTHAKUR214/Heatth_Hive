import express from "express";
import multer from "multer";
import DoctorProfile from "../models/DoctorProfile.js";
import { verifyUser, requireDoctor } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// GET public doctor profile by username (no auth required)
router.get("/public/:username", async (req, res) => {
  try {
    const User = (await import("../models/User.js")).default;
    const user = await User.findOne({ username: req.params.username }).select("_id");
    if (!user) return res.status(404).json({ message: "User not found" });
    const profile = await DoctorProfile.findOne({ owner: user._id })
      .select("fullName specialty qualification hospitalName city phone availableForConsultation verificationStatus");
    return res.json({ profile: profile || null });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch doctor profile" });
  }
});

// GET profile (own - auth required)
router.get("/profile", verifyUser, requireDoctor, async (req, res) => {
  try {
    const profile = await DoctorProfile.findOne({ owner: req.user._id });
    return res.json({ profile: profile || null });
  } catch (err) {
    console.error("Fetch doctor profile error:", err);
    return res.status(500).json({ message: "Failed to fetch profile" });
  }
});

// POST create/update profile (no docs)
router.post("/profile", verifyUser, requireDoctor, async (req, res) => {
  try {
    const { fullName, specialty, qualification, registrationNo, hospitalName, phone, city } = req.body;

    if (!fullName || !specialty || !qualification || !registrationNo) {
      return res.status(400).json({ message: "fullName, specialty, qualification and registrationNo are required" });
    }

    let profile = await DoctorProfile.findOne({ owner: req.user._id });

    if (!profile) {
      profile = new DoctorProfile({ owner: req.user._id });
    }

    profile.fullName       = fullName;
    profile.specialty      = specialty;
    profile.qualification  = qualification;
    profile.registrationNo = registrationNo;
    if (hospitalName !== undefined) profile.hospitalName = hospitalName;
    if (phone       !== undefined) profile.phone        = phone;
    if (city        !== undefined) profile.city         = city;

    profile.verificationStatus = "pending";

    await profile.save();
    return res.json({ message: "Profile saved", profile });
  } catch (err) {
    console.error("Save doctor profile error:", err);
    return res.status(500).json({ message: "Failed to save profile" });
  }
});

// POST upload documents
router.post(
  "/profile/documents",
  verifyUser,
  requireDoctor,
  upload.fields([
    { name: "medicalDegree",           maxCount: 1 },
    { name: "registrationCertificate", maxCount: 1 },
    { name: "governmentId",            maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const profile = await DoctorProfile.findOne({ owner: req.user._id });
      if (!profile) return res.status(404).json({ message: "Profile not found. Please fill your profile first." });

      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ message: "No documents uploaded" });
      }

      Object.entries(req.files).forEach(([field, fileArr]) => {
        const file = fileArr[0];
        profile.documents[field] = {
          url:    `/uploads/${file.filename}`,
          status: "pending",
        };
      });

      profile.verificationStatus = "pending";
      await profile.save();

      return res.json({ message: "Documents uploaded successfully", documents: profile.documents });
    } catch (err) {
      console.error("Doctor upload docs error:", err);
      return res.status(500).json({ message: "Upload failed" });
    }
  }
);

// PATCH toggle consultation availability
router.patch("/profile/availability", verifyUser, requireDoctor, async (req, res) => {
  try {
    const profile = await DoctorProfile.findOne({ owner: req.user._id });
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    profile.availableForConsultation = !profile.availableForConsultation;
    await profile.save();
    return res.json({ available: profile.availableForConsultation });
  } catch (err) {
    return res.status(500).json({ message: "Failed to update availability" });
  }
});
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ message: err.message });
  if (err.message === "Invalid file type") return res.status(400).json({ message: "Invalid file type" });
  next(err);
});

export default router;