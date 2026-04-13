import express from "express";
import Question from "../models/Questions.js";
import User from "../models/User.js";
import SpaceMember from "../models/SpaceMember.js";
import { verifyUser } from "../middleware/auth.js";
import { questionUpload } from "../utils/questionUpload.js";
import { resizePostImages } from "../middleware/resizeImages.js";

const router = express.Router();

// ── helper: check active space membership ──────────────────────────────────
const requireSpaceMember = async (spaceId, userId) => {
  if (!spaceId) return true;
  const m = await SpaceMember.findOne({ spaceId, userId, status: "active" });
  return !!m;
};

/* ─────────────────────────────────────────────────────────────────────────────
   CREATE QUESTION
───────────────────────────────────────────────────────────────────────────── */
router.post(
  "/",
  verifyUser,
  questionUpload.array("images", 7),
  resizePostImages,
  async (req, res) => {
    try {
      const { title, content, description, spaceId } = req.body || {};

      if (!title || (!content && !description)) {
        return res.status(400).json({ message: "Title and description required" });
      }

      // ✅ Member check when posting to a space
      if (spaceId) {
        const isMember = await requireSpaceMember(spaceId, req.user._id);
        if (!isMember) return res.status(403).json({ message: "You must be a member to post in this space" });
      }

      const topics = req.body.topics ? JSON.parse(req.body.topics) : [];
      const images = (req.files || []).map(file => ({
        path: `/uploads/questions/${file.filename}`,
        size: file.size,
      }));

      const question = new Question({
        title,
        description: description || content,
        postedBy:   req.user._id,
        topics,
        images,
        spaceId:    spaceId || null,
        visibility: "public",
        type:       "question",
        stats: { likes: 0, dislikes: 0, shares: 0, flags: 0, comments: 0 },
      });
      
      await question.save();
      res.status(201).json(question);
    } catch (err) {
      console.error("Failed to create question:", err);
      res.status(500).json({ message: "Failed to create question" });
    }
  }
);

/* ─────────────────────────────────────────────────────────────────────────────
   GET QUESTIONS BY SPACE  ← new route
───────────────────────────────────────────────────────────────────────────── */
router.get("/space/:spaceId", async (req, res) => {
  try {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 15;
    const skip  = (page - 1) * limit;

    const questions = await Question.find({ spaceId: req.params.spaceId, visibility: "public" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("postedBy", "name username avatar role")
      .populate("spaceId", "title slug");

    const total = await Question.countDocuments({ spaceId: req.params.spaceId, visibility: "public" });

    res.json({ items: questions, page, hasMore: skip + questions.length < total, total });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch space questions" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   GET ALL QUESTIONS
───────────────────────────────────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const limit   = Number(req.query.limit) || 10;
    const cursor  = req.query.cursor;
    const topic   = req.query.topic?.trim().toLowerCase().replace(/^#/, "");
    const sortBy  = req.query.sortBy || "recent"; // "recent" | "likes"

    const query = {};
    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }
    if (topic) {
      query.topics = { $in: [topic] };
    }

    const sortQuery = sortBy === "likes"
      ? { "stats.likes": -1 }
      : { createdAt: -1 };

    const questions = await Question.find(query)
      .sort(sortQuery)
      .limit(limit + 1)
      .select("title description images spaceId postedBy stats topics type createdAt")
      .populate("postedBy", "name username avatar role isRoleVerified")
      .populate("spaceId", "title slug")
      .lean();

    const hasMore = questions.length > limit;
    if (hasMore) questions.pop();

    // normalize type to match feed format
    const items = questions.map(q => ({ ...q, type: "questions" }));

    const nextCursor = hasMore ? items[items.length - 1].createdAt : null;

    res.json({ items, nextCursor });
  } catch (err) {
    console.error("Failed to fetch questions:", err);
    res.status(500).json({ message: "Failed to fetch questions" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   GET SINGLE QUESTION
───────────────────────────────────────────────────────────────────────────── */
router.get("/:id", async (req, res) => {
  try {
    const data = await Question.findById(req.params.id).populate("postedBy", "name username avatar role isRoleVerified");
    if (!data) return res.status(404).json({ message: "Question not found" });
    res.json({ type: "question", data });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   GET QUESTIONS BY USERNAME (profile)
───────────────────────────────────────────────────────────────────────────── */
router.get("/user/username/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username }).select("_id");
    if (!user) return res.status(404).json({ message: "User not found" });

    const questions = await Question.find({
      postedBy: user._id,
      $or: [{ visibility: "public" }, { visibility: { $exists: false } }],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .populate("postedBy", "name username avatar role isRoleVerified");

    const total = await Question.countDocuments({ postedBy: user._id, visibility: "public" });
    res.json({ items: questions, page, hasMore: skip + questions.length < total });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch questions" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   GET LIKED QUESTIONS BY USERNAME (profile)
───────────────────────────────────────────────────────────────────────────── */
router.get("/user/liked/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username }).select("_id");
    if (!user) return res.status(404).json({ message: "User not found" });

    const filter = { likes: user._id, $or: [{ visibility: "public" }, { visibility: { $exists: false } }] };
    const questions = await Question.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().populate("postedBy", "name username avatar role isRoleVerified");
    const total = await Question.countDocuments(filter);

    res.json({ items: questions, page, hasMore: skip + questions.length < total });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch liked questions" });
  }
});
  /* ── EDIT question (owner only, within 5 min) ── */
  router.patch("/:id", verifyUser, async (req, res) => {
    try {
      const question = await Question.findById(req.params.id);
      if (!question) return res.status(404).json({ message: "Question not found" });
      if (question.postedBy.toString() !== req.user._id.toString())
        return res.status(403).json({ message: "Not authorized" });

      const ageMs = Date.now() - new Date(question.createdAt).getTime();
      if (ageMs > 5 * 60 * 1000)
        return res.status(403).json({ message: "Edit window expired (5 minutes)" });

      if (req.body.title)       question.title       = req.body.title;
      if (req.body.description) question.description = req.body.description;
      await question.save();
      res.json({ message: "Question updated", question });
    } catch {
      res.status(500).json({ message: "Server error" });
    }
  });

  /* ── DELETE question (owner only) ── */
  router.delete("/:id", verifyUser, async (req, res) => {
    try {
      const question = await Question.findById(req.params.id);
      if (!question) return res.status(404).json({ message: "Question not found" });
      if (question.postedBy.toString() !== req.user._id.toString())
        return res.status(403).json({ message: "Not authorized" });
      await question.deleteOne();
      res.json({ message: "Question deleted" });
    } catch {
      res.status(500).json({ message: "Server error" });
    }
  });
export default router;
