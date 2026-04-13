import express from "express";
import mongoose from "mongoose";
import { verifyUser } from "../middleware/auth.js";
import Conversation  from "../models/Conversation.js";
import DirectMessage from "../models/DirectMessage.js";
import Block         from "../models/Block.js";
import User          from "../models/User.js";
import { encryptMessage, decryptMessage } from "../utils/encryption.js";
import { messageUpload } from "../utils/messageUpload.js";

const router = express.Router();

/* ── helpers ── */
const isBlocked = async (userA, userB) => {
  const block = await Block.findOne({
    $or: [
      { blocker: userA, blocked: userB },
      { blocker: userB, blocked: userA },
    ],
  }).lean();
  return !!block;
};

const getOrCreateConversation = async (userA, userB) => {
  const sorted = [userA, userB].map(String).sort();
  let convo = await Conversation.findOne({ participants: { $all: sorted } }).lean();
  if (!convo) {
    convo = await Conversation.create({ participants: sorted });
    convo = convo.toObject();
  }
  return convo;
};

/* ─────────────────────────────────────────────────────────────────────────────
   IMPORTANT: Specific/static routes MUST come before dynamic /:conversationId
   Otherwise /block/list and /conversation/:userId get swallowed by /:conversationId
───────────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────
   GET /api/messages
   Inbox — all conversations for current user
──────────────────────────────────────────── */
router.get("/", verifyUser, async (req, res) => {
  try {
    const uid = req.user._id;

    const conversations = await Conversation.find({
      participants: uid,
      deletedFor:   { $ne: uid },
    })
      .populate("participants", "name username avatar role isOnline lastSeen")
      .populate("lastMessage.sender", "name username")
      .sort({ "lastMessage.sentAt": -1 })
      .lean();

    const inbox = conversations.map(c => {
      const other   = c.participants.find(p => p._id.toString() !== uid.toString());
      const unread  = c.unreadCount?.[uid.toString()] || 0;
      const isMuted = c.mutedBy?.map(String).includes(uid.toString());
      return { ...c, other, unread, isMuted };
    });

    res.json({ conversations: inbox });
  } catch (err) {
    console.error("Inbox error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ────────────────────────────────────────────
   POST /api/messages/conversation/:userId
   Start or get conversation with a user
──────────────────────────────────────────── */
router.post("/conversation/:userId", verifyUser, async (req, res) => {
  try {
    const uid     = req.user?._id;
    const otherId = req.params.userId;

    if (!uid) return res.status(401).json({ message: "Authentication required" });
    if (uid.toString() === otherId)
      return res.status(400).json({ message: "Cannot message yourself" });
    if (await isBlocked(uid, otherId))
      return res.status(403).json({ message: "Unable to send message" });

    const other = await User.findById(otherId).select("_id name username avatar role").lean();
    if (!other) return res.status(404).json({ message: "User not found" });

    const convo = await getOrCreateConversation(uid, otherId);
    res.json({ conversationId: convo._id });
  } catch (err) {
    console.error("Start convo error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ────────────────────────────────────────────
   GET /api/messages/block/list
   Get my blocked users
──────────────────────────────────────────── */
router.get("/block/list", verifyUser, async (req, res) => {
  try {
    const blocks = await Block.find({ blocker: req.user._id })
      .populate("blocked", "name username avatar")
      .lean();
    res.json({ blocked: blocks.map(b => b.blocked) });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ────────────────────────────────────────────
   POST /api/messages/block/:userId
   Block a user
──────────────────────────────────────────── */
router.post("/block/:userId", verifyUser, async (req, res) => {
  try {
    const uid     = req.user._id;
    const otherId = req.params.userId;
    if (uid.toString() === otherId)
      return res.status(400).json({ message: "Cannot block yourself" });

    await Block.findOneAndUpdate(
      { blocker: uid, blocked: otherId },
      { blocker: uid, blocked: otherId },
      { upsert: true }
    );
    res.json({ message: "User blocked" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ────────────────────────────────────────────
   DELETE /api/messages/block/:userId
   Unblock a user
──────────────────────────────────────────── */
router.delete("/block/:userId", verifyUser, async (req, res) => {
  try {
    await Block.findOneAndDelete({ blocker: req.user._id, blocked: req.params.userId });
    res.json({ message: "User unblocked" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   DYNAMIC /:conversationId routes below — these must come LAST
───────────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────
   GET /api/messages/:conversationId
   Load messages (paginated) + decrypt
──────────────────────────────────────────── */
router.get("/:conversationId", verifyUser, async (req, res) => {
  try {
    const uid              = req.user._id;
    const { conversationId } = req.params;
    const limit            = Math.min(Number(req.query.limit) || 50, 100);
    const before           = req.query.before;

    const convo = await Conversation.findById(conversationId).lean();
    if (!convo) return res.status(404).json({ message: "Conversation not found" });
    if (!convo.participants.map(String).includes(uid.toString()))
      return res.status(403).json({ message: "Not authorized" });

    const query = { conversationId, deletedFor: { $ne: uid } };
    if (before) query.createdAt = { $lt: new Date(before) };

    const messages = await DirectMessage.find(query)
      .populate("sender", "name username avatar role")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // mark as read
    await Conversation.findByIdAndUpdate(conversationId, {
      [`unreadCount.${uid}`]: 0,
    });
    await DirectMessage.updateMany(
      { conversationId, readBy: { $ne: uid } },
      { $addToSet: { readBy: uid } }
    );

    const populatedConvo = await Conversation.findById(conversationId)
      .populate("participants", "name username avatar role isOnline lastSeen")
      .lean();

    // ── decrypt messages before sending to client ──
    const decryptedMessages = messages.map(m => ({
      ...m,
      text: m.text ? decryptMessage(m.text, conversationId) : null,
    }));

    res.json({
      messages:     decryptedMessages.reverse(),
      hasMore:      messages.length === limit,
      conversation: populatedConvo,
    });
  } catch (err) {
    console.error("Load messages error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ────────────────────────────────────────────
   POST /api/messages/:conversationId
   Send a message (text + optional attachments)
──────────────────────────────────────────── */
router.post(
  "/:conversationId",
  verifyUser,
  messageUpload.array("attachments", 5),
  async (req, res) => {
    try {
      const uid              = req.user._id;
      const { conversationId } = req.params;
      const text = req.body.text ? String(req.body.text) : null;

      if (!text?.trim() && (!req.files || req.files.length === 0))
        return res.status(400).json({ message: "Message or attachment required" });
      if (text?.trim().length > 4000)
        return res.status(400).json({ message: "Message too long" });

      const convo = await Conversation.findById(conversationId).lean();
      if (!convo) return res.status(404).json({ message: "Conversation not found" });
      if (!convo.participants.map(String).includes(uid.toString()))
        return res.status(403).json({ message: "Not authorized" });

      const otherId = convo.participants.find(p => p.toString() !== uid.toString());
      if (await isBlocked(uid, otherId))
        return res.status(403).json({ message: "Unable to send message" });

      // ── encrypt text ──
      let encryptedText = null;
      if (text?.trim()) {
        const { encrypted } = encryptMessage(text.trim(), conversationId);
        encryptedText = encrypted;
      }

      // ── handle attachments ──
      const attachments = (req.files || []).map(file => ({
        url:      `/uploads/messages/${file.filename}`,
        name:     file.originalname,
        size:     file.size,
        mimeType: file.mimetype,
      }));

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const msg = await DirectMessage.create({
        conversationId,
        sender: uid,
        text:   encryptedText,
        attachments,
        readBy: [uid],
        expiresAt,
      });

      await msg.populate("sender", "name username avatar role");

      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: {
          text:   text?.trim() ? "🔒 Encrypted message" : "📎 Attachment",
          sender: uid,
          sentAt: msg.createdAt,
        },
        $pull: { deletedFor: otherId },
        $inc:  { [`unreadCount.${otherId}`]: 1 },
      });

      // ── emit decrypted to socket room ──
      const msgToEmit = {
        ...msg.toObject(),
        text:        text?.trim() || null,
        attachments: msg.attachments,
      };

      req.app.get("io")?.to(`convo:${conversationId}`).emit("message:new", msgToEmit);
      req.app.get("io")?.to(`user:${otherId}`).emit("inbox:update");

      res.status(201).json({ message: msgToEmit });
    } catch (err) {
      console.error("Send message error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* ────────────────────────────────────────────
   DELETE /api/messages/:conversationId/message/:msgId
   Delete a message
──────────────────────────────────────────── */
router.delete("/:conversationId/message/:msgId", verifyUser, async (req, res) => {
  try {
    const uid                    = req.user._id;
    const { msgId, conversationId } = req.params;
    const { forEveryone }        = req.query;

    const msg = await DirectMessage.findOne({ _id: msgId, conversationId });
    if (!msg) return res.status(404).json({ message: "Message not found" });

    if (forEveryone === "true" && msg.sender.toString() !== uid.toString())
      return res.status(403).json({ message: "Only sender can delete for everyone" });

    if (forEveryone === "true") {
      msg.text = null;
      msg.type = "system";
      await msg.save();
      req.app.get("io")?.to(`convo:${conversationId}`).emit("message:deleted", { msgId, forEveryone: true });
    } else {
      await DirectMessage.findByIdAndUpdate(msgId, { $addToSet: { deletedFor: uid } });
    }

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ────────────────────────────────────────────
   DELETE /api/messages/:conversationId
   Delete entire conversation (for me only)
──────────────────────────────────────────── */
router.delete("/:conversationId", verifyUser, async (req, res) => {
  try {
    const uid   = req.user._id;
    const convo = await Conversation.findById(req.params.conversationId);
    if (!convo) return res.status(404).json({ message: "Not found" });
    if (!convo.participants.map(String).includes(uid.toString()))
      return res.status(403).json({ message: "Not authorized" });

    await Conversation.findByIdAndUpdate(req.params.conversationId, {
      $addToSet: { deletedFor: uid },
      [`unreadCount.${uid}`]: 0,
    });

    res.json({ message: "Conversation deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ────────────────────────────────────────────
   POST /api/messages/:conversationId/mute
   Toggle mute
──────────────────────────────────────────── */
router.post("/:conversationId/mute", verifyUser, async (req, res) => {
  try {
    const uid   = req.user._id;
    const convo = await Conversation.findById(req.params.conversationId);
    if (!convo) return res.status(404).json({ message: "Not found" });

    const isMuted = convo.mutedBy.map(String).includes(uid.toString());
    if (isMuted) {
      await Conversation.findByIdAndUpdate(req.params.conversationId, { $pull:     { mutedBy: uid } });
    } else {
      await Conversation.findByIdAndUpdate(req.params.conversationId, { $addToSet: { mutedBy: uid } });
    }

    res.json({ muted: !isMuted });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;