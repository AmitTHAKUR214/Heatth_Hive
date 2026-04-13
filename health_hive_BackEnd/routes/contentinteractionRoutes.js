import express from "express";
import User from "../models/User.js";
import Post from "../models/Posts.js";
import Question from "../models/Questions.js";
import Comment from "../models/Comment.js";
import { verifyUser } from "../middleware/auth.js";
import ContentInteraction from "../models/ContentInteraction.js";

const MODEL_MAP = { post: Post, question: Question, comment: Comment };

const router = express.Router();

/* ── POST /interact ── */
router.post("/interact", verifyUser, async (req, res) => {
  try {
    let { contentId, contentType, action } = req.body;
    const userId = req.user._id;

    contentType = contentType.toLowerCase();
    if (contentType.endsWith("s")) contentType = contentType.slice(0, -1);
    action = action.toLowerCase();

    const ContentModel = MODEL_MAP[contentType];
    if (!ContentModel) return res.status(400).json({ message: "Invalid content type" });

    const existing = await ContentInteraction.find({ contentType, contentId, userId }).lean();
    const has = (a) => existing.some(i => i.action === a);

    const inc = {};
    const toCreate = [];
    const toRemove = [];

    if (action === "like") {
      if (has("like")) {
        toRemove.push("like"); inc["stats.likes"] = -1;
      } else {
        toCreate.push("like"); inc["stats.likes"] = 1;
        if (has("dislike")) { toRemove.push("dislike"); inc["stats.dislikes"] = -1; }
      }
    } else if (action === "dislike") {
      if (has("dislike")) {
        toRemove.push("dislike"); inc["stats.dislikes"] = -1;
      } else {
        toCreate.push("dislike"); inc["stats.dislikes"] = 1;
        if (has("like")) { toRemove.push("like"); inc["stats.likes"] = -1; }
      }
    } else if (action === "share" && !has("share")) {
      toCreate.push("share"); inc["stats.shares"] = 1;
    } else if (action === "flag") {
      if (has("flag")) {
        toRemove.push("flag"); inc["stats.flags"] = -1;
      } else {
        toCreate.push("flag"); inc["stats.flags"] = 1;
      }
    }

    if (toRemove.length) {
      await ContentInteraction.deleteMany({ contentType, contentId, userId, action: { $in: toRemove } });
    }
    if (toCreate.length) {
      await ContentInteraction.insertMany(toCreate.map(a => ({ contentType, contentId, userId, action: a })));
    }
    if (Object.keys(inc).length) {
      await ContentModel.updateOne({ _id: contentId }, { $inc: inc });
    }

    const updated = await ContentModel.findById(contentId).select("stats").lean();
    res.json({ stats: updated.stats });

  } catch (err) {
    console.error("INTERACT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

/* ── GET /stats/:contentType/:contentId ── */
router.get("/stats/:contentType/:contentId", verifyUser, async (req, res) => {
  try {
    let { contentType, contentId } = req.params;
    contentType = contentType.toLowerCase();
    if (contentType.endsWith("s")) contentType = contentType.slice(0, -1);

    const Model = MODEL_MAP[contentType];
    if (!Model) return res.status(400).json({ message: "Invalid content type" });

    const content = await Model.findById(contentId).select("stats").lean();
    if (!content) return res.status(404).json({ message: "Not found" });

    res.json(content.stats);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

/* ── GET /liked/:username ── */
router.get("/liked/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const profileUser = await User.findOne({ username }).select("_id").lean();
    if (!profileUser) return res.status(404).json({ message: "User not found" });

    const interactions = await ContentInteraction.find({ userId: profileUser._id, action: "like" })
      .sort({ createdAt: -1 }).lean();

    const postIds     = interactions.filter(i => i.contentType === "post").map(i => i.contentId);
    const questionIds = interactions.filter(i => i.contentType === "question").map(i => i.contentId);

    const [posts, questions] = await Promise.all([
      Post.find({ _id: { $in: postIds } }).populate("postedBy", "name username avatar role isRoleVerified").lean(),
      Question.find({ _id: { $in: questionIds } }).populate("postedBy", "name username avatar role isRoleVerified").lean(),
    ]);

    const allItems = [
      ...posts.map(p => ({ ...p, type: "posts" })),
      ...questions.map(q => ({ ...q, type: "questions" })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const paginatedItems = allItems.slice(skip, skip + limit);

    // attach userInteraction for the currently logged-in viewer
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const jwt = (await import("jsonwebtoken")).default;
        const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
        const viewerId = decoded.userId;

        const contentIds = paginatedItems.map(i => i._id);
        const viewerInteractions = await ContentInteraction.find({
          userId: viewerId,
          contentId: { $in: contentIds },
        }).lean();

        const interactionMap = {};
        viewerInteractions.forEach(i => {
          if (!interactionMap[i.contentId.toString()]) interactionMap[i.contentId.toString()] = [];
          interactionMap[i.contentId.toString()].push(i.action);
        });

        const enriched = paginatedItems.map(item => ({
          ...item,
          userInteraction: {
            liked:    (interactionMap[item._id.toString()] || []).includes("like"),
            disliked: (interactionMap[item._id.toString()] || []).includes("dislike"),
            flagged:  (interactionMap[item._id.toString()] || []).includes("flag"),
            shared:   (interactionMap[item._id.toString()] || []).includes("share"),
          },
        }));

        return res.json({ items: enriched, page, hasMore: skip + paginatedItems.length < allItems.length });
      } catch { /* not logged in — return without userInteraction */ }
    }

    res.json({ items: paginatedItems, page, hasMore: skip + paginatedItems.length < allItems.length });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch liked content" });
  }
});

export default router;