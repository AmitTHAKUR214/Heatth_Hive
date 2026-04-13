import express from "express";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import sendEmail from "../utils/SendEmail.js";
import jwt from "jsonwebtoken";

const router = express.Router();

function normalizeUsername(username) {
  if (!username) throw new Error("Username cannot be empty");
  let normalized = username.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (normalized.length < 3) throw new Error("Username too short (min 3 chars)");
  return normalized;
}

/* ── REGISTER ── */
router.post("/register", async (req, res) => {
  try {
    const { role, name, email, password, username: rawUsername } = req.body;
    if (!role) return res.status(400).json({ message: "Role is required" });

    if (role === "guest") {
      const guestSuffix = crypto.randomUUID().slice(0, 8);
      const guestUsername = `guest_${guestSuffix}`;
      const guestEmail    = `${guestUsername}@guest.healthhive.local`;
      const guestUser = new User({
        role: "guest", name: name?.trim() || "Anonymous",
        username: guestUsername, email: guestEmail,
        password: crypto.randomBytes(16).toString("hex"),
        isEmailVerified: true, isRoleVerified: true,
      });
      await guestUser.save();
      return res.status(201).json({ message: "Registered as guest", user: { id: guestUser._id, role: guestUser.role, name: guestUser.name, username: guestUser.username } });
    }

    if (!email || !password || !name) return res.status(400).json({ message: "Name, email and password are required" });
    if (!rawUsername) return res.status(400).json({ message: "Username is required" });

    let username;
    try { username = normalizeUsername(rawUsername); }
    catch (err) { return res.status(400).json({ message: err.message }); }

    if (await User.findOne({ username })) return res.status(409).json({ message: "Username already taken" });
    if (await User.findOne({ email: email.toLowerCase().trim() })) return res.status(409).json({ message: "Email already registered" });

    const hashedPassword     = await bcrypt.hash(password, 10);
    const emailVerifyToken   = crypto.randomBytes(32).toString("hex");
    const emailVerifyExpires = new Date(Date.now() + 30 * 60 * 1000);

    const user = new User({
      role, name: name.trim(), username,
      email: email.toLowerCase().trim(), password: hashedPassword,
      isEmailVerified: false, isRoleVerified: false,
      emailVerifyToken, emailVerifyExpires,
    });
    await user.save();

    try {
      const verifyUrl = `${process.env.BASE_URL}/verify-email?token=${emailVerifyToken}`;
      await sendEmail({
        to: user.email, subject: "Verify your email",
        html: `<h2>Welcome to HealthHive</h2><p>Please verify your email:</p><a href="${verifyUrl}">Verify Email</a><p>This link expires in 30 minutes.</p>`,
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError); // check terminal for root cause
    }

    return res.status(201).json({ message: "Registration successful. Please verify your email." });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ message: "Registration failed" });
  }
});

/* ── VERIFY EMAIL ── */
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.redirect(`${process.env.CLIENT_URL}/login?verified=false`);

    const user = await User.findOne({ emailVerifyToken: token, emailVerifyExpires: { $gt: Date.now() } });
    if (!user) return res.redirect(`${process.env.CLIENT_URL}/login?verified=expired`);

    user.isEmailVerified   = true;
    user.emailVerifyToken   = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();

    return res.redirect(`${process.env.CLIENT_URL}/login?verified=true`);
  } catch {
    return res.redirect(`${process.env.CLIENT_URL}/login?verified=error`);
  }
});

/* ── LOGIN ── */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });
    if (!user.isEmailVerified) return res.status(403).json({ message: "Please verify your email before logging in" });

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user._id, name: user.name, username: user.username, role: user.role, avatar: user.avatar, isEmailVerified: user.isEmailVerified, isRoleVerified: user.isRoleVerified } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

/* ── GET CURRENT USER ── */
router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ message: "Authentication required" });
  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    const user    = await User.findById(decoded.userId).select("_id name username avatar role isEmailVerified isRoleVerified");
    if (!user) return res.status(401).json({ message: "User not found" });
    res.json({ id: user._id, name: user.name, username: user.username, role: user.role, avatar: user.avatar, isEmailVerified: user.isEmailVerified, isRoleVerified: user.isRoleVerified });
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

/* ── USER SEARCH (autocomplete) ── */
router.get("/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.json([]);
    const users = await User.find({ name: { $regex: query, $options: "i" } }).limit(10);
    res.json(users.map(u => ({ _id: u._id, name: u.name, avatar: u.avatar })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;