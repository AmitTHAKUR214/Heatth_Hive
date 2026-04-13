import express from "express";
import Question from "../models/Questions.js";
import Post from "../models/Posts.js";
import User from "../models/User.js";
import DoctorProfile from "../models/DoctorProfile.js";
import Pharmacy from "../models/Pharmacy.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json({ users: [], content: [] });

    const regex = new RegExp(q, "i");

    const [questions, posts, users] = await Promise.all([
      Question.find({ $or: [{ title: regex }, { description: regex }] })
        .populate("postedBy", "name username avatar role isRoleVerified lastSeen")
        .lean(),
      Post.find({ $or: [{ title: regex }, { description: regex }] })
        .populate("postedBy", "name username avatar role isRoleVerified lastSeen")
        .lean(),
      User.find({
        role: { $in: ["doctor", "pharmacist", "student"] },
        isEmailVerified: true,
        $or: [{ name: regex }, { username: regex }],
      })
        .select("name username avatar role isRoleVerified lastSeen")
        .limit(20)
        .lean(),
    ]);

    // attach doctor specialty + availability
    const doctorIds    = users.filter(u => u.role === "doctor").map(u => u._id);
    const pharmacyIds  = users.filter(u => u.role === "pharmacist").map(u => u._id);

    const [doctorProfiles, pharmacies] = await Promise.all([
      DoctorProfile.find({ owner: { $in: doctorIds } }).select("owner specialty availableForConsultation verificationStatus").lean(),
      Pharmacy.find({ owner: { $in: pharmacyIds } }).select("owner name verificationStatus").lean(),
    ]);

    const doctorMap   = Object.fromEntries(doctorProfiles.map(d => [d.owner.toString(), d]));
    const pharmacyMap = Object.fromEntries(pharmacies.map(p => [p.owner.toString(), p]));

    const enrichedUsers = users.map(u => {
      const id = u._id.toString();
      if (u.role === "doctor")     return { ...u, doctorProfile: doctorMap[id]   || null };
      if (u.role === "pharmacist") return { ...u, pharmacy:      pharmacyMap[id] || null };
      return u;
    });

    const content = [
      ...questions.map(q => ({ ...q, type: "question" })),
      ...posts.map(p => ({ ...p, type: "post" })),
    ];

    res.json({ users: enrichedUsers, content });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Search failed" });
  }
});

export default router;