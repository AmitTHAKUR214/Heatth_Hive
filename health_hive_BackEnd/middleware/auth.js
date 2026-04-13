import jwt from "jsonwebtoken";
import User from "../models/User.js";
import SpaceMember from "../models/SpaceMember.js";

/* ── verifyUser — attaches req.user, stamps lastSeen ── */
export const verifyUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId)
      .select("_id name username avatar role isEmailVerified isRoleVerified")
      .lean();
    if (!user) return res.status(401).json({ message: "User not found" });
    req.user = user;
    // stamp lastSeen max once every 5 minutes — reduces DB writes by ~99%
    const key = `ls_${decoded.userId}`;
    if (!global._lastSeenCache) global._lastSeenCache = {};
    const now = Date.now();
    if (!global._lastSeenCache[key] || now - global._lastSeenCache[key] > 5 * 60 * 1000) {
      global._lastSeenCache[key] = now;
      User.findByIdAndUpdate(decoded.userId, { lastSeen: new Date() }).catch(() => {});
    }
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/* ── optionalVerifyUser — decodes JWT if present, DB lookup only if token valid ── */
export const optionalVerifyUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return next();
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // only hit DB if token is valid — skip for guests/no token
    const user = await User.findById(decoded.userId)
      .select("_id name username avatar role isEmailVerified isRoleVerified")
      .lean(); // lean = plain object, faster
    if (user) req.user = user;
  } catch { /* invalid token — treat as guest */ }
  next();
};

/* ── verifyAdmin — separate JWT check for admin panel ── */
export const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Admin authentication required" });
  }
  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    if (decoded.role !== "admin") return res.status(403).json({ message: "Access denied" });
    req.admin = { id: decoded.userId, role: decoded.role };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/* ── Role guards — all require verifyUser to run first ── */
export const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  next();
};

export const requireDoctor = (req, res, next) => {
  if (req.user?.role !== "doctor") return res.status(403).json({ message: "Doctors only" });
  next();
};

export const requirePharmacist = (req, res, next) => {
  if (req.user?.role !== "pharmacist") return res.status(403).json({ message: "Pharmacists only" });
  next();
};

export const requireVerifiedDoctor = (req, res, next) => {
  if (req.user?.role !== "doctor") return res.status(403).json({ message: "Doctors only" });
  if (!req.user?.isRoleVerified) return res.status(403).json({ message: "Doctor verification required" });
  next();
};

export const requireVerifiedPharmacist = (req, res, next) => {
  if (req.user?.role !== "pharmacist") return res.status(403).json({ message: "Pharmacists only" });
  if (!req.user?.isRoleVerified) return res.status(403).json({ message: "Pharmacy verification required" });
  next();
};

/* ── Space admin guard ── */
export const requireSpaceAdmin = async (req, res, next) => {
  try {
    const { spaceId } = req.params;
    const member = await SpaceMember.findOne({
      spaceId, userId: req.user._id,
      role: { $in: ["owner", "admin"] }, status: "active",
    });
    if (!member) return res.status(403).json({ message: "Not authorized" });
    next();
  } catch {
    res.status(500).json({ message: "Authorization failed" });
  }
};