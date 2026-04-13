import mongoose from "mongoose";
import User from "../models/User.js";
import Post from "../models/Posts.js";
import Question from "../models/Questions.js";
import Comment from "../models/Comment.js";
import Space from "../models/Space.js";
import SpaceMember from "../models/SpaceMember.js";
import ContentInteraction from "../models/ContentInteraction.js";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";

export const getProfileById = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const user = await User.findById(userId).select("name avatar role bio createdAt").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const [posts, questions, comments, likesGiven, spacesCreated, spacesJoined] = await Promise.all([
      Post.countDocuments({ postedBy: userId }),
      Question.countDocuments({ postedBy: userId }),
      Comment.countDocuments({ userId, isDeleted: false }),
      ContentInteraction.countDocuments({ userId, action: "like" }),
      Space.countDocuments({ createdBy: userId }),
      Space.countDocuments({ members: userId }),
    ]);

    res.json({
      user: { id: user._id, name: user.name, avatar: user.avatar, role: user.role, bio: user.bio, createdAt: user.createdAt },
      stats: { posts, questions, comments, likesGiven, spacesCreated, spacesJoined },
    });
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

export const getProfileByUsername = async (req, res) => {
  try {
    const username = req.params.username?.toLowerCase().trim();
    if (!username) return res.status(400).json({ message: "Username required" });

    const profileUser = await User.findOne({ username })
      .select("_id username name avatar bio role isRoleVerified createdAt lastSeen isOnline")
      .lean();
    if (!profileUser) return res.status(404).json({ message: "User not found" });

    // determine viewer
    let viewerUserId = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const jwt = (await import("jsonwebtoken")).default;
        const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
        viewerUserId = decoded.userId;
      } catch { /* not logged in */ }
    }
    const isOwner = viewerUserId?.toString() === profileUser._id.toString();
    const cutoff = new Date(Date.now() - 2 * 60 * 1000);
    const isOnlineLive = profileUser.isOnline && profileUser.lastSeen >= cutoff;

    const [posts, questions, comments, likesGiven, spacesJoined] = await Promise.all([
      Post.countDocuments({ postedBy: profileUser._id, visibility: "public" }),
      Question.countDocuments({ postedBy: profileUser._id }),
      Comment.countDocuments({ userId: profileUser._id, isDeleted: false }),
      ContentInteraction.countDocuments({ userId: profileUser._id, action: "like" }),
      SpaceMember.countDocuments({ userId: profileUser._id, status: "active" }),
    ]);

    res.json({
      profile: {
        _id:        profileUser._id,
        username:   profileUser.username,
        name:       profileUser.name,
        avatar:     profileUser.avatar,
        bio:        profileUser.bio,
        role:       profileUser.role,
        isVerified: profileUser.isRoleVerified,
        createdAt:  profileUser.createdAt,
        lastSeen:   profileUser.lastSeen,
        isOnline:   isOnlineLive,
      },
      stats: { posts, questions, comments, likesGiven, spacesJoined },
      viewer: { isOwner, canEdit: isOwner },
      _meta: isOwner ? { userId: profileUser._id } : undefined,
    });
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ message: "Failed to load profile" });
  }
};

export const getUserSpaces = async (req, res) => {
  try {
    const { username } = req.params;
    const type = req.query.type || "joined";

    const user = await User.findOne({ username }).select("_id").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    let spaces = [];

    if (type === "created") {
      spaces = await Space.find({ createdBy: user._id, status: "active" })
        .select("title slug description icon banner memberCount createdAt visibility")
        .sort({ createdAt: -1 }).lean();
    } else {
      const memberships = await SpaceMember.find({ userId: user._id, status: "active" })
        .populate({ path: "spaceId", select: "title slug description icon banner createdAt visibility status", match: { status: "active" } })
        .sort({ joinedAt: -1 }).lean();
      spaces = memberships.filter(m => m.spaceId).map(m => m.spaceId);
    }

    // attach live member counts
    const spaceIds = spaces.map(s => s._id);
    const counts   = await SpaceMember.aggregate([
      { $match: { spaceId: { $in: spaceIds }, status: "active" } },
      { $group: { _id: "$spaceId", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map(c => [c._id.toString(), c.count]));
    spaces = spaces.map(s => ({ ...s, memberCount: countMap[s._id.toString()] || 0 }));

    res.json({ spaces, type });
  } catch (err) {
    console.error("UserSpaces error:", err);
    res.status(500).json({ message: "Failed to fetch spaces" });
  }
};

export const getOnlineUsers = async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000); // 2 min — heartbeat is 60s

    // clear stale isOnline flags in background
    User.updateMany(
      { isOnline: true, lastSeen: { $lt: cutoff } },
      { isOnline: false }
    ).catch(() => {});

    const users = await User.find({
      $or: [{ isOnline: true }, { lastSeen: { $gte: cutoff } }],
      role:     { $nin: ["guest", "admin"] },
      isBanned: { $ne: true },
    })
      .select("name username avatar role isRoleVerified lastSeen isOnline inChat")
      .sort({ lastSeen: -1 })
      .limit(200)
      .lean();

    res.json({ users, count: users.length });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

const avatarDir = path.join(process.cwd(), "uploads/avatars");
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: avatarDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(file.originalname)}`),
});
export const avatarUpload = multer({ storage: avatarStorage, limits: { fileSize: 3 * 1024 * 1024 } });

export const updateProfile = async (req, res) => {
  try {
    const { name, bio, username } = req.body;
    const update = {};
    console.log("body:", req.body);
    console.log("file:", req.file);

    if (name?.trim())     update.name = name.trim();
    if (bio !== undefined) update.bio = bio.trim();

    // ── username change ──
    if (username?.trim()) {
      const clean = username.trim().toLowerCase();
      const taken = await User.findOne({ username: clean, _id: { $ne: req.user._id } });
      if (taken) return res.status(409).json({ message: "Username already taken" });
      update.username = clean;
    }

    // ── avatar upload ──
    if (req.file) {
      const filename = `avatar-${req.user._id}-${Date.now()}.jpg`;
      const outPath  = path.join(avatarDir, filename);
      await sharp(req.file.path).resize(200, 200).jpeg({ quality: 85 }).toFile(outPath);
      fs.unlinkSync(req.file.path);
      update.avatar = `/uploads/avatars/${filename}`;
    }

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true })
      .select("name bio avatar username");
    res.json({ user });
  } catch (err) {
    console.error("updateProfile error:", err); 
    if (err.code === 11000) return res.status(409).json({ message: "Username already taken" });
    res.status(500).json({ message: "Failed to update profile" });
  }
};


export const getUserStats = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select("_id").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [postsCount, questionsCount, commentsCount, likesReceived, postsByMonth, questionsByMonth] = await Promise.all([
      Post.countDocuments({ postedBy: user._id }),
      Question.countDocuments({ postedBy: user._id }),
      Comment.countDocuments({ userId: user._id, isDeleted: false }),
      ContentInteraction.countDocuments({ targetUserId: user._id, action: "like" }),
      Post.aggregate([
        { $match: { postedBy: user._id, createdAt: { $gte: sixMonthsAgo } } },
        { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
      ]),
      Question.aggregate([
        { $match: { postedBy: user._id, createdAt: { $gte: sixMonthsAgo } } },
        { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
      ]),
    ]);

    res.json({ postsCount, questionsCount, commentsCount, likesReceived, postsByMonth, questionsByMonth });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};