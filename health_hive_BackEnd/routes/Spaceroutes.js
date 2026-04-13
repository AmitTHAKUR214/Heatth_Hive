import express from "express";
import Space from "../models/Space.js";
import SpaceMember from "../models/SpaceMember.js";
import { verifyUser, optionalVerifyUser } from "../middleware/auth.js";

const router = express.Router();

// ── helpers ──────────────────────────────────────────────────────────────────
const isOwnerOrAdmin = async (spaceId, userId) => {
  const m = await SpaceMember.findOne({ spaceId, userId, status: "active" });
  return m && (m.role === "owner" || m.role === "admin");
};

/* ─────────────────────────────────────────────────────────────────────────────
   PUBLIC / OPTIONAL-AUTH ROUTES
───────────────────────────────────────────────────────────────────────────── */

// GET all spaces (public listing) — with memberStatus if logged in
router.get("/", optionalVerifyUser, async (req, res) => {
  try {
    const spaces = await Space.find({ status: "active" })
      .populate("createdBy", "name username avatar")
      .sort({ createdAt: -1 });

    // Attach memberCount and memberStatus per space if user is logged in
    const spaceIds = spaces.map((s) => s._id);
    const memberCounts = await SpaceMember.aggregate([
      { $match: { spaceId: { $in: spaceIds }, status: "active" } },
      { $group: { _id: "$spaceId", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(memberCounts.map((m) => [m._id.toString(), m.count]));

    let statusMap = {};
    if (req.user) {
      const memberships = await SpaceMember.find({ spaceId: { $in: spaceIds }, userId: req.user._id });
      statusMap = Object.fromEntries(memberships.map((m) => [m.spaceId.toString(), m.status]));
    }

    const result = spaces.map((s) => ({
      ...s.toObject(),
      memberCount:  countMap[s._id.toString()] || 0,
      memberStatus: statusMap[s._id.toString()] || null,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET space by slug — public, works without login (for shareable page)
router.get("/slug/:slug", optionalVerifyUser, async (req, res) => {
  try {
    const space = await Space.findOne({ slug: req.params.slug })
      .populate("createdBy", "name username avatar");

    if (!space) return res.status(404).json({ message: "Space not found" });

    // Member count from SpaceMember collection (source of truth)
    const memberCount = await SpaceMember.countDocuments({ spaceId: space._id, status: "active" });

    // If logged in, check membership status
    let memberStatus = null;
    let memberRole   = null;
    if (req.user) {
      const membership = await SpaceMember.findOne({ spaceId: space._id, userId: req.user._id });
      if (membership) {
        memberStatus = membership.status; // active | pending | rejected | left | banned
        memberRole   = membership.role;   // owner | admin | member
      }
    }

    res.json({ ...space.toObject(), memberCount, memberStatus, memberRole });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET space by ID (internal)
router.get("/id/:id", optionalVerifyUser, async (req, res) => {
  try {
    const space = await Space.findById(req.params.id)
      .populate("createdBy", "name username avatar");
    if (!space) return res.status(404).json({ message: "Space not found" });
    res.json(space);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   CREATE SPACE
───────────────────────────────────────────────────────────────────────────── */
router.post("/", verifyUser, async (req, res) => {
  try {
    const { title, description, icon, visibility = "public" } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: "Title is required" });

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (await Space.findOne({ slug })) return res.status(409).json({ message: "Space already exists" });

    const space = await Space.create({ title, description, icon, slug, visibility, createdBy: req.user._id });

    // Creator is automatically owner in SpaceMember
    await SpaceMember.create({ spaceId: space._id, userId: req.user._id, role: "owner", status: "active" });

    res.status(201).json(space);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Space creation failed" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   JOIN / REQUEST TO JOIN
───────────────────────────────────────────────────────────────────────────── */
router.post("/slug/:slug/join", verifyUser, async (req, res) => {
  try {
    const space = await Space.findOne({ slug: req.params.slug });
    if (!space) return res.status(404).json({ message: "Space not found" });

    const existing = await SpaceMember.findOne({ spaceId: space._id, userId: req.user._id });

    if (existing) {
      if (existing.status === "active")   return res.status(409).json({ message: "Already a member" });
      if (existing.status === "pending")  return res.status(409).json({ message: "Request already pending" });
      if (existing.status === "banned")   return res.status(403).json({ message: "You are banned from this space" });

      // Rejoin after leaving or being rejected
      existing.status = space.visibility === "private" ? "pending" : "active";
      existing.joinedAt = new Date();
      await existing.save();
      return res.json({ message: existing.status === "active" ? "Joined" : "Request sent", status: existing.status });
    }

    // New member
    const status = space.visibility === "private" ? "pending" : "active";
    await SpaceMember.create({ spaceId: space._id, userId: req.user._id, role: "member", status });

    // Also add to Space.members array if public (instant join)
    if (status === "active") {
      await Space.findByIdAndUpdate(space._id, { $addToSet: { members: req.user._id } });
    }

    res.json({ message: status === "active" ? "Joined successfully" : "Request sent, awaiting approval", status });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   LEAVE SPACE
───────────────────────────────────────────────────────────────────────────── */
router.post("/slug/:slug/leave", verifyUser, async (req, res) => {
  try {
    const space = await Space.findOne({ slug: req.params.slug });
    if (!space) return res.status(404).json({ message: "Space not found" });

    const membership = await SpaceMember.findOne({ spaceId: space._id, userId: req.user._id });
    if (!membership || membership.status !== "active") return res.status(400).json({ message: "Not a member" });
    if (membership.role === "owner") return res.status(400).json({ message: "Owner cannot leave. Transfer ownership first." });

    membership.status = "left";
    await membership.save();
    await Space.findByIdAndUpdate(space._id, { $pull: { members: req.user._id } });

    res.json({ message: "Left space" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   GET MEMBERS (paginated)
───────────────────────────────────────────────────────────────────────────── */
router.get("/slug/:slug/members", optionalVerifyUser, async (req, res) => {
  try {
    const space = await Space.findOne({ slug: req.params.slug });
    if (!space) return res.status(404).json({ message: "Space not found" });

    const members = await SpaceMember.find({ spaceId: space._id, status: "active" })
      .populate("userId", "name username avatar")
      .sort({ role: 1, joinedAt: 1 });

    res.json({ members });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   GET PENDING REQUESTS (admin only)
───────────────────────────────────────────────────────────────────────────── */
router.get("/slug/:slug/requests", verifyUser, async (req, res) => {
  try {
    const space = await Space.findOne({ slug: req.params.slug });
    if (!space) return res.status(404).json({ message: "Space not found" });

    if (!(await isOwnerOrAdmin(space._id, req.user._id)))
      return res.status(403).json({ message: "Admins only" });

    const requests = await SpaceMember.find({ spaceId: space._id, status: "pending" })
      .populate("userId", "name username avatar")
      .sort({ createdAt: 1 });

    res.json({ requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   APPROVE / REJECT REQUEST (admin only)
───────────────────────────────────────────────────────────────────────────── */
router.patch("/slug/:slug/requests/:userId/approve", verifyUser, async (req, res) => {
  try {
    const space = await Space.findOne({ slug: req.params.slug });
    if (!space) return res.status(404).json({ message: "Space not found" });
    if (!(await isOwnerOrAdmin(space._id, req.user._id))) return res.status(403).json({ message: "Admins only" });

    const membership = await SpaceMember.findOne({ spaceId: space._id, userId: req.params.userId, status: "pending" });
    if (!membership) return res.status(404).json({ message: "Request not found" });

    membership.status   = "active";
    membership.joinedAt = new Date();
    await membership.save();
    await Space.findByIdAndUpdate(space._id, { $addToSet: { members: req.params.userId } });

    res.json({ message: "Request approved" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/slug/:slug/requests/:userId/reject", verifyUser, async (req, res) => {
  try {
    const space = await Space.findOne({ slug: req.params.slug });
    if (!space) return res.status(404).json({ message: "Space not found" });
    if (!(await isOwnerOrAdmin(space._id, req.user._id))) return res.status(403).json({ message: "Admins only" });

    await SpaceMember.findOneAndUpdate(
      { spaceId: space._id, userId: req.params.userId, status: "pending" },
      { status: "rejected" }
    );

    res.json({ message: "Request rejected" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   BAN / REMOVE MEMBER (admin only)
───────────────────────────────────────────────────────────────────────────── */
router.patch("/slug/:slug/members/:userId/ban", verifyUser, async (req, res) => {
  try {
    const space = await Space.findOne({ slug: req.params.slug });
    if (!space) return res.status(404).json({ message: "Space not found" });
    if (!(await isOwnerOrAdmin(space._id, req.user._id))) return res.status(403).json({ message: "Admins only" });

    const target = await SpaceMember.findOne({ spaceId: space._id, userId: req.params.userId });
    if (!target) return res.status(404).json({ message: "Member not found" });
    if (target.role === "owner") return res.status(403).json({ message: "Cannot ban the owner" });

    target.status = "banned";
    await target.save();
    await Space.findByIdAndUpdate(space._id, { $pull: { members: req.params.userId } });

    res.json({ message: "Member banned" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/slug/:slug/members/:userId/remove", verifyUser, async (req, res) => {
  try {
    const space = await Space.findOne({ slug: req.params.slug });
    if (!space) return res.status(404).json({ message: "Space not found" });
    if (!(await isOwnerOrAdmin(space._id, req.user._id))) return res.status(403).json({ message: "Admins only" });

    await SpaceMember.findOneAndDelete({ spaceId: space._id, userId: req.params.userId });
    await Space.findByIdAndUpdate(space._id, { $pull: { members: req.params.userId } });

    res.json({ message: "Member removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   PROMOTE TO ADMIN (owner only)
───────────────────────────────────────────────────────────────────────────── */
router.patch("/slug/:slug/members/:userId/promote", verifyUser, async (req, res) => {
  try {
    const space = await Space.findOne({ slug: req.params.slug });
    if (!space) return res.status(404).json({ message: "Space not found" });

    // Only owner can promote
    const requester = await SpaceMember.findOne({ spaceId: space._id, userId: req.user._id, role: "owner" });
    if (!requester) return res.status(403).json({ message: "Owner only" });

    const target = await SpaceMember.findOne({ spaceId: space._id, userId: req.params.userId, status: "active" });
    if (!target) return res.status(404).json({ message: "Member not found" });

    target.role = "admin";
    await target.save();

    // Also add to Space.admins array for backwards compat
    await Space.findByIdAndUpdate(space._id, {
      $addToSet: { admins: { id: req.params.userId } }
    });

    res.json({ message: "Promoted to admin" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/slug/:slug/members/:userId/demote", verifyUser, async (req, res) => {
  try {
    const space = await Space.findOne({ slug: req.params.slug });
    if (!space) return res.status(404).json({ message: "Space not found" });

    const requester = await SpaceMember.findOne({ spaceId: space._id, userId: req.user._id, role: "owner" });
    if (!requester) return res.status(403).json({ message: "Owner only" });

    await SpaceMember.findOneAndUpdate(
      { spaceId: space._id, userId: req.params.userId },
      { role: "member" }
    );

    res.json({ message: "Demoted to member" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   ADD ADMIN (legacy — kept for backwards compat)
───────────────────────────────────────────────────────────────────────────── */
router.post("/slug/:slug/admins", verifyUser, async (req, res) => {
  try {
    const { userId } = req.body;
    const space = await Space.findOne({ slug: req.params.slug });
    if (!space) return res.status(404).json({ message: "Space not found" });
    if (space.createdBy.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Owner only" });

    await SpaceMember.findOneAndUpdate(
      { spaceId: space._id, userId },
      { role: "admin" },
      { upsert: true }
    );

    res.json({ message: "Admin added" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


/* ─────────────────────────────────────────────────────────────────────────────
   UPDATE SPACE SETTINGS (owner/admin only)
───────────────────────────────────────────────────────────────────────────── */
router.patch("/slug/:slug", verifyUser, async (req, res) => {
  try {
    const space = await Space.findOne({ slug: req.params.slug });
    if (!space) return res.status(404).json({ message: "Space not found" });
    if (!(await isOwnerOrAdmin(space._id, req.user._id)))
      return res.status(403).json({ message: "Admins only" });

    const { title, description, icon, banner, visibility, theme } = req.body;
    if (title !== undefined)       space.title       = title.trim();
    if (description !== undefined) space.description = description;
    if (icon !== undefined)        space.icon        = icon;
    if (banner !== undefined)      space.banner      = banner;
    if (visibility !== undefined)  space.visibility  = visibility;
    if (theme !== undefined)       space.theme       = theme;

    await space.save();
    res.json(space);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;