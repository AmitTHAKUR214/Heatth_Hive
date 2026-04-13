import express from "express";
import Notification from "../models/Notification.js";
import { verifyUser } from "../middleware/auth.js";
import { verifyAdmin } from "../middleware/auth.js";
import User from "../models/User.js";
import { notifyAnnouncement } from "../services/notificationService.js";

const router = express.Router();

/* ── GET /api/notifications — fetch for current user ── */
router.get("/", verifyUser, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = notifications.filter((n) => !n.isRead).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

/* ── PATCH /api/notifications/:id/read — mark one as read ── */
router.patch("/:id/read", verifyUser, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true }
    );
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark as read" });
  }
});

/* ── PATCH /api/notifications/read-all — mark all as read ── */
router.patch("/read-all", verifyUser, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
    res.json({ message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Failed" });
  }
});

/* ── DELETE /api/notifications/:id — delete one ── */
router.delete("/:id", verifyUser, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete" });
  }
});

/* ── POST /api/notifications/announce — admin broadcast ── */
router.post("/announce", verifyAdmin, async (req, res) => {
  try {
    const { title, message, role } = req.body;
    if (!title || !message) return res.status(400).json({ message: "Title and message required" });

    const filter = role ? { role } : {};
    const users  = await User.find(filter).select("_id");
    const ids    = users.map((u) => u._id);

    await notifyAnnouncement(ids, title, message);
    res.json({ message: `Announcement sent to ${ids.length} users` });
  } catch (err) {
    res.status(500).json({ message: "Failed to send announcement" });
  }
});

export default router;