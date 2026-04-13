import express from "express";
import Admin from "../models/Admin.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

// REGISTER ADMIN
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const exists = await Admin.findOne({ email });
    if (exists) return res.status(409).json({ message: "Admin already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await Admin.create({ name, email, password: hashedPassword });

    res.status(201).json({
      message: "Admin created",
      admin: { id: admin._id, name: admin.name, email: admin.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Admin registration failed" });
  }
});

// LOGIN ADMIN
router.post("/login", async (req, res) => {
  // find admin by email
  const admin = await Admin.findOne({ email: req.body.email });
  if (!admin) return res.status(401).json({ message: "Invalid credentials" });

  // compare password
  const isMatch = await bcrypt.compare(req.body.password, admin.password);
  if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

  // sign JWT
  const token = jwt.sign({ adminId: admin._id, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "7d" });

  // ✅ Return admin data
  res.json({
    token,
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: "admin",
    },
  });
});

export default router;
