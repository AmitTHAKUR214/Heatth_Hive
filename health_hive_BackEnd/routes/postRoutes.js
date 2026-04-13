import express from "express";
import Post from "../models/Posts.js";
import User from "../models/User.js";
import SpaceMember from "../models/SpaceMember.js";
import { verifyUser } from "../middleware/auth.js";
import { postUpload } from "../utils/postUpload.js";
import { resizePostImages } from "../middleware/resizeImages.js";

const router = express.Router();

// ── helper: check active space membership ──────────────────────────────────
const requireSpaceMember = async (spaceId, userId) => {
  if (!spaceId) return true; // no space context — always allowed
  const m = await SpaceMember.findOne({ spaceId, userId, status: "active" });
  return !!m;
};

/* ─────────────────────────────────────────────────────────────────────────────
   CREATE POST
───────────────────────────────────────────────────────────────────────────── */
router.post(
  "/",
  verifyUser,
  postUpload.array("images", 7),
  resizePostImages,
  async (req, res) => {
    try {
      const { title, content, description, spaceId } = req.body || {};

      if (!title || (!content && !description)) {
        return res.status(400).json({ message: "Title and description required" });
      }

      // ✅ If posting to a space, must be an active member
      if (spaceId) {
        const isMember = await requireSpaceMember(spaceId, req.user._id);
        if (!isMember) return res.status(403).json({ message: "You must be a member to post in this space" });
      }

      const topics = req.body.topics ? JSON.parse(req.body.topics) : [];
      const images = (req.files || []).map(file => ({
        path: `/uploads/posts/${file.filename}`,
        size: file.size,
      }));

      const post = new Post({
        title,
        description: description || content,
        postedBy: req.user._id,
        topics,
        images,
        spaceId: spaceId || null,
        visibility: "public",
        type: "post",
        stats: { likes: 0, dislikes: 0, shares: 0, flags: 0, comments: 0 },
      });

      await post.save();
      res.status(201).json(post);
    } catch (err) {
      console.error("Failed to create post:", err);
      res.status(500).json({ message: "Failed to create post" });
    }
  }
);

/* ─────────────────────────────────────────────────────────────────────────────
   GET POSTS BY SPACE  ← new route
───────────────────────────────────────────────────────────────────────────── */
router.get("/space/:spaceId", async (req, res) => {
  try {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 15;
    const skip  = (page - 1) * limit;

    const posts = await Post.find({ spaceId: req.params.spaceId, visibility: "public" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("postedBy", "name username avatar role")
      .populate("spaceId", "title slug");

    const total = await Post.countDocuments({ spaceId: req.params.spaceId, visibility: "public" });

    res.json({ items: posts, page, hasMore: skip + posts.length < total, total });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch space posts" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   GET ALL POSTS (global feed)
───────────────────────────────────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("postedBy", "name username avatar role isRoleVerified");
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   GET SINGLE POST
───────────────────────────────────────────────────────────────────────────── */
router.get("/:id", async (req, res) => {
  try {
    const data = await Post.findById(req.params.id).populate("postedBy", "name username avatar role isRoleVerified");
    if (!data) return res.status(404).json({ message: "Post not found" });
    res.json({ type: "post", data });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   GET POSTS BY USER (admin)
───────────────────────────────────────────────────────────────────────────── */
router.get("/user/:userId", async (req, res) => {
  try {
    const posts = await Post.find({ postedBy: req.params.userId, visibility: "public" })
      .sort({ createdAt: -1 })
      .populate("postedBy", "name avatar");
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user posts" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   GET POSTS BY USERNAME (profile)
───────────────────────────────────────────────────────────────────────────── */
router.get("/user/username/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username }).select("_id");
    if (!user) return res.status(404).json({ message: "User not found" });

    const posts = await Post.find({
      postedBy: user._id,
      $or: [{ visibility: "public" }, { visibility: { $exists: false } }],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .populate("postedBy", "name username avatar role isRoleVerified");

    const total = await Post.countDocuments({ postedBy: user._id, visibility: "public" });
    res.json({ items: posts, page, hasMore: skip + posts.length < total });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user posts" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   GET LIKED POSTS BY USERNAME (profile)
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
    const posts  = await Post.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().populate("postedBy", "name username avatar role isRoleVerified");
    const total  = await Post.countDocuments(filter);

    res.json({ items: posts, page, hasMore: skip + posts.length < total });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch liked posts" });
  }
});

  /* ── EDIT post (owner only, within 5 min) ── */
  router.patch("/:id", verifyUser, async (req, res) => {
    try {
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ message: "Post not found" });
      if (post.postedBy.toString() !== req.user._id.toString())
        return res.status(403).json({ message: "Not authorized" });

      const ageMs = Date.now() - new Date(post.createdAt).getTime();
      if (ageMs > 5 * 60 * 1000)
        return res.status(403).json({ message: "Edit window expired (5 minutes)" });

      if (req.body.title)       post.title       = req.body.title;
      if (req.body.description) post.description = req.body.description;
      await post.save();
      res.json({ message: "Post updated", post });
    } catch {
      res.status(500).json({ message: "Server error" });
    }
  });

  /* ── DELETE post (owner only) ── */
  router.delete("/:id", verifyUser, async (req, res) => {
    try {
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ message: "Post not found" });
      if (post.postedBy.toString() !== req.user._id.toString())
        return res.status(403).json({ message: "Not authorized" });
      await post.deleteOne();
      res.json({ message: "Post deleted" });
    } catch {
      res.status(500).json({ message: "Server error" });
    }
  });
export default router;
