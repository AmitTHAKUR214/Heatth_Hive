import express from "express";
import { verifyUser } from "../middleware/auth.js";
import * as profile from "../controllers/userProfileController.js";
import User from "../models/User.js";
import { avatarUpload } from "../controllers/userProfileController.js";

const router = express.Router();

// IMPORTANT: /online must be before /:username to avoid route collision
router.get   ("/online",              profile.getOnlineUsers);
router.get   ("/:userId/profile",     profile.getProfileById);
router.get   ("/profile/:username",   profile.getProfileByUsername);
router.get   ("/:username/spaces",    profile.getUserSpaces);
router.get   ("/:username/stats",     profile.getUserStats);
router.patch("/me/profile", verifyUser, avatarUpload.single("avatar"), profile.updateProfile);

/* ── Presence ── */
router.post("/heartbeat", verifyUser, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    isOnline: true,
    lastSeen: new Date(),
  });
  res.json({ ok: true });
});

router.post("/offline", verifyUser, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    isOnline: false,
    lastSeen: new Date(),
  });
  res.json({ ok: true });
});

export default router;