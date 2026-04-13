import express from "express";
import Post from "../models/Posts.js";
import Question from "../models/Questions.js";
import mongoose from "mongoose";
import ContentInteraction from "../models/ContentInteraction.js";
import { optionalVerifyUser } from "../middleware/auth.js";

const ROLE_TOPICS = {
  doctor:     ["medicine", "clinical", "diagnosis", "treatment", "medical", "health", "surgery"],
  pharmacist: ["pharmacy", "drugs", "medication", "dosage", "prescription", "compounding"],
  student:    ["study", "exams", "university", "learning", "research", "education", "notes"],
  normal:     [],
  guest:      [],
};

// deterministic shuffle seeded by userId — same user always gets same order per session
function seededShuffle(arr, seed) {
  const s = [...arr];
  let h = [...seed].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  for (let i = s.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(h) % (i + 1);
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

const router = express.Router();

/**
 * GET /api/feed?limit=10&cursor=ISO_DATE&topic=diabetes
 */
router.get("/", optionalVerifyUser, async (req, res) => {
  const t0 = Date.now();
  try {
    const limit      = Number(req.query.limit) || 10;
    const cursor     = req.query.cursor;
    const topic      = req.query.topic?.trim().toLowerCase().replace(/^#/, "");
    const role       = req.query.role?.trim().toLowerCase() || "guest";
    const roleTopics = ROLE_TOPICS[role] || [];

    const dateQuery = cursor ? { createdAt: { $lt: new Date(cursor) } } : {};
    const topicQuery = topic ? { topics: { $in: [topic] } } : {};
    const query = { ...dateQuery, ...topicQuery };

    const t1 = Date.now();

    const [posts, questions] = await Promise.all([
      Post.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("title description images spaceId postedBy stats topics type visibility createdAt")
        .populate("postedBy", "name username avatar role isRoleVerified")
        .populate("spaceId", "title slug")
        .lean(),

      Question.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("title description images spaceId postedBy stats topics type createdAt")
        .populate("postedBy", "name username avatar role isRoleVerified")
        .populate("spaceId", "title slug")
        .lean()
    ]);
    const t2 = Date.now();

    const normalizedPosts = posts.map(p => ({
      ...p,
      type: "posts",
      author: p.postedBy
    }));

    const normalizedQuestions = questions.map(q => ({
      ...q,
      type: "questions",
      author: q.postedBy
    }));

    const merged = [...normalizedPosts, ...normalizedQuestions]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit + 1);

    if (req.user) {
      const contentIds = merged.map(item => item._id);

      const interactions = await ContentInteraction.find({
        userId: req.user._id,
        contentId: { $in: contentIds }
      }).lean();
      const t3 = Date.now();

      const interactionMap = {};
      interactions.forEach(i => {
        const id = i.contentId.toString();
        if (!interactionMap[id]) interactionMap[id] = [];
        interactionMap[id].push(i.action);
      });

      merged.forEach(item => {
        const actions = interactionMap[item._id.toString()] || [];
        item.userInteraction = {
          liked:    actions.includes("like"),
          disliked: actions.includes("dislike"),
          flagged:  actions.includes("flag"),
          shared:   actions.includes("share")
        };
      });
      // console.log(`[feed] interactions: ${t3 - t2}ms`);
    }

    const userId = req.user?._id?.toString() || "guest";
    let feed = merged;
    if (roleTopics.length) {
      const boosted = seededShuffle(
        feed.filter(i => i.topics?.some(t => roleTopics.includes(t.toLowerCase()))),
        userId
      );
      const rest = seededShuffle(
        feed.filter(i => !i.topics?.some(t => roleTopics.includes(t.toLowerCase()))),
        userId
      );
      feed = [...boosted, ...rest];
    } else {
      feed = seededShuffle(feed, userId); // guest/normal still get unique order
    }

    const hasMore    = feed.length > limit;
    if (hasMore) feed.pop();
    const nextCursor = hasMore ? feed[feed.length - 1].createdAt : null;
    res.set("Cache-Control", "private, max-age=30");
    res.json({ items: feed, nextCursor });


  } catch (err) {
    console.error("Feed error:", err);
    res.status(500).json({ message: "Failed to fetch feed" });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/feed/topics/suggestions?q=diab
   Returns matching topics from both posts and questions
───────────────────────────────────────────────────────────── */
router.get("/topics/suggestions", async (req, res) => {
  try {
    const q = req.query.q?.trim().toLowerCase().replace(/^#/, "");
    if (!q || q.length < 1) return res.json([]);

    const regex = new RegExp(`^${q}`, "i");

    // Get matching topics from both collections in parallel
    const [postTopics, questionTopics] = await Promise.all([
      Post.distinct("topics",     { topics: regex }),
      Question.distinct("topics", { topics: regex }),
    ]);

    // Merge, deduplicate, sort, limit to 8
    const all = [...new Set([...postTopics, ...questionTopics])]
      .filter(t => t)
      .sort()
      .slice(0, 8);

    res.json(all);
  } catch (err) {
    res.status(500).json([]);
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/feed/:id — single item resolver
───────────────────────────────────────────────────────────── */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid content id" });
  }

  try {
    const post = await Post.findById(id)
      .populate("postedBy", "name username avatar role isRoleVerified")
      .populate("spaceId", "title slug")
      .lean();

    if (post) {
      return res.json({ ...post, type: "posts", author: post.postedBy });
    }

    const question = await Question.findById(id)
      .populate("postedBy", "name username avatar role isRoleVerified")
      .populate("spaceId", "title slug")
      .lean();

    if (question) {
      return res.json({ ...question, type: "questions", author: question.postedBy });
    }

    return res.status(404).json({ message: "Content not found" });
  } catch (err) {
    console.error("Feed resolver error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;