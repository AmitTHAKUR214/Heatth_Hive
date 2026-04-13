import Comment from "../models/Comment.js";
import Post from "../models/Posts.js";
import Question from "../models/Questions.js";
import User from "../models/User.js";

const normalize = (type) => {
  const t = type.toLowerCase();
  return t.endsWith("s") ? t.slice(0, -1) : t;
};

export const postComment = async (req, res) => {
  try {
    let { text, parentCommentId, contentType, contentId } = req.body;
    contentType = normalize(contentType);
    if (!contentType || !contentId) return res.status(400).json({ message: "contentType and contentId are required" });
    if (!text?.trim()) return res.status(400).json({ message: "Comment cannot be empty" });

    const comment = await Comment.create({
      contentType, contentId, text,
      userId: req.user._id,
      parentCommentId: parentCommentId || null,
    });

    // keep stats.comments accurate so feed card shows correct count without extra fetch
    const Model = contentType === "post" ? Post : Question;
    await Model.findByIdAndUpdate(contentId, { $inc: { "stats.comments": 1 } });

    res.status(201).json(comment);
  } catch (err) {
    console.error("Post comment error:", err);
    res.status(500).json({ message: "Failed to post comment" });
  }
};

export const postReply = async (req, res) => {
  try {
    let { contentType, contentId, parentCommentId, text } = req.body;
    contentType = normalize(contentType);
    if (!text?.trim()) return res.status(400).json({ message: "Reply text required" });

    const parent = await Comment.findById(parentCommentId);
    if (!parent) return res.status(404).json({ message: "Parent comment not found" });

    const reply = await Comment.create({ contentType, contentId, parentCommentId, text, userId: req.user._id });
    await Comment.findByIdAndUpdate(parentCommentId, { $inc: { "stats.replies": 1 } });
    const populated = await reply.populate("userId", "name avatar username");
    res.status(201).json(populated);
  } catch (err) {
    console.error("Reply error:", err);
    res.status(500).json({ message: "Failed to add reply" });
  }
};

export const getComments = async (req, res) => {
  try {
    let { contentType, contentId } = req.params;
    contentType = normalize(contentType);

    const comments = await Comment.find({ contentType, contentId, isDeleted: false })
      .populate("userId", "name avatar username")
      .sort({ createdAt: 1 })
      .lean();

    // build tree
    const map = {};
    comments.forEach(c => { c.replies = []; c.repliesCount = c.stats?.replies || 0; map[c._id.toString()] = c; });
    const tree = [];
    comments.forEach(c => {
      if (c.parentCommentId) map[c.parentCommentId.toString()]?.replies.push(c);
      else tree.push(c);
    });

    // attach userAction if authenticated
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const jwt = (await import("jsonwebtoken")).default;
        const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
        const uid = decoded.userId.toString();
        const attachAction = (list) => list.map(c => ({
          ...c,
          userAction: c.likedBy?.map(String).includes(uid)
            ? "like"
            : c.dislikedBy?.map(String).includes(uid)
              ? "dislike"
              : null,
          replies: attachAction(c.replies || []),
        }));
        return res.json(attachAction(tree));
      } catch { /* not logged in */ }
    }

    res.json(tree);
  } catch (err) {
    console.error("Fetch comments error:", err);
    res.status(500).json({ message: "Failed to fetch comments" });
  }
};

export const getUserComments = async (req, res) => {
  try {
    const { username } = req.params;
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 7;
    const skip  = (page - 1) * limit;

    const user = await User.findOne({ username }).select("_id name avatar");
    if (!user) return res.status(404).json({ message: "User not found" });

    const comments = await Comment.find({ userId: user._id, isDeleted: false })
      .sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

    const populated = await Promise.all(comments.map(async c => {
      const type = normalize(c.contentType);
      if (type === "post")     c.post     = await Post.findById(c.contentId).select("title").lean();
      if (type === "question") c.question = await Question.findById(c.contentId).select("title").lean();
      if (c.parentCommentId) {
        const parent = await Comment.findById(c.parentCommentId).select("text userId createdAt contentType contentId").lean();
        if (parent) {
          parent.author = await User.findById(parent.userId).select("_id name avatar username").lean();
        }
        c.parentComment = parent;
      }
      c.author = { _id: user._id, name: user.name, avatar: user.avatar };
      return c;
    }));

    const total = await Comment.countDocuments({ userId: user._id, isDeleted: false });
    res.json({ items: populated, page, hasMore: skip + populated.length < total });
  } catch (err) {
    console.error("Fetch user comments error:", err);
    res.status(500).json({ message: "Failed to fetch user comments" });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (comment.userId.toString() !== req.user._id) return res.status(403).json({ message: "Not authorized" });
    await comment.deleteOne();

    const Model = comment.contentType === "post" ? Post : Question;
    await Model.findByIdAndUpdate(comment.contentId, { $inc: { "stats.comments": -1 } });

    res.json({ message: "Comment deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete comment" });
  }
};

export const editComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Not found" });
    if (comment.userId.toString() !== req.user._id) return res.status(403).json({ message: "Not authorized" });
    comment.text = req.body.text;
    await comment.save();
    res.json(comment);
  } catch {
    res.status(500).json({ message: "Failed to edit comment" });
  }
};

export const interactComment = async (req, res) => {
  try {
    const { action } = req.body;
    if (!["like", "dislike"].includes(action)) {
      return res.status(400).json({ message: "action must be like or dislike" });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const uid        = req.user._id.toString();
    const hasLiked   = comment.likedBy.map(String).includes(uid);
    const hasDisliked = comment.dislikedBy.map(String).includes(uid);

    if (action === "like") {
      if (hasLiked) {
        // toggle off
        comment.likedBy.pull(req.user._id);
        comment.stats.likes = Math.max(0, comment.stats.likes - 1);
      } else {
        // add like, remove dislike if present
        comment.likedBy.push(req.user._id);
        comment.stats.likes += 1;
        if (hasDisliked) {
          comment.dislikedBy.pull(req.user._id);
          comment.stats.dislikes = Math.max(0, comment.stats.dislikes - 1);
        }
      }
    } else {
      if (hasDisliked) {
        // toggle off
        comment.dislikedBy.pull(req.user._id);
        comment.stats.dislikes = Math.max(0, comment.stats.dislikes - 1);
      } else {
        // add dislike, remove like if present
        comment.dislikedBy.push(req.user._id);
        comment.stats.dislikes += 1;
        if (hasLiked) {
          comment.likedBy.pull(req.user._id);
          comment.stats.likes = Math.max(0, comment.stats.likes - 1);
        }
      }
    }

    await comment.save();

    const userAction = comment.likedBy.map(String).includes(uid)
      ? "like"
      : comment.dislikedBy.map(String).includes(uid)
        ? "dislike"
        : null;

    res.json({ stats: comment.stats, userAction });
  } catch (err) {
    console.error("Comment interact error:", err);
    res.status(500).json({ message: "Server error" });
  }
};