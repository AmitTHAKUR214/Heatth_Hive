import express from "express";
import ConsultationRequest from "../models/ConsultationRequest.js";
import DoctorProfile from "../models/DoctorProfile.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import { verifyUser } from "../middleware/auth.js";
import { createNotification } from "../services/notificationService.js";

const router = express.Router();

/* ── POST / — patient sends a request ── */
router.post("/", verifyUser, async (req, res) => {
  try {
    const { doctorId, message } = req.body;
    if (!doctorId || !message?.trim())
      return res.status(400).json({ message: "doctorId and message are required" });
    if (req.user._id.toString() === doctorId)
      return res.status(400).json({ message: "You cannot consult yourself" });

    const doctor = await User.findById(doctorId).select("role isRoleVerified name");
    if (!doctor || doctor.role !== "doctor")
      return res.status(404).json({ message: "Doctor not found" });
    if (!doctor.isRoleVerified)
      return res.status(403).json({ message: "Doctor is not yet verified" });

    const profile = await DoctorProfile.findOne({ owner: doctorId }).select("availableForConsultation");
    if (!profile?.availableForConsultation)
      return res.status(403).json({ message: "Doctor is not currently accepting consultations" });

    const existing = await ConsultationRequest.findOne({ patient: req.user._id, doctor: doctorId, status: "pending" });
    if (existing)
      return res.status(409).json({ message: "You already have a pending request with this doctor" });

    const request = await ConsultationRequest.create({ patient: req.user._id, doctor: doctorId, message: message.trim() });

    await createNotification(doctorId, "consultation_request", "📩 New consultation request",
      `${req.user.name} has sent you a consultation request.`,
      { patientId: req.user._id, requestId: request._id }
    );

    res.status(201).json({ message: "Request sent", request });
  } catch (err) {
    console.error("Send consultation error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ── GET /my-requests — patient's sent requests ── */
router.get("/my-requests", verifyUser, async (req, res) => {
  try {
    const requests = await ConsultationRequest.find({ patient: req.user._id })
      .populate("doctor", "name username avatar")
      .sort({ createdAt: -1 })
      .lean();

    const doctorIds  = requests.map(r => r.doctor?._id).filter(Boolean);
    const profiles   = await DoctorProfile.find({ owner: { $in: doctorIds } }).select("owner specialty");
    const profileMap = Object.fromEntries(profiles.map(p => [p.owner.toString(), p.specialty]));

    const enriched = requests.map(r => ({
      ...r.toObject(),
      doctorSpecialty: profileMap[r.doctor?._id?.toString()] || null,
    }));

    res.json({ requests: enriched });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ── GET /incoming — doctor's received requests ── */
router.get("/incoming", verifyUser, async (req, res) => {
  try {
    if (req.user.role !== "doctor")
      return res.status(403).json({ message: "Doctors only" });

    const { status } = req.query;
    const filter = { doctor: req.user._id };
    if (status) filter.status = status;

    const requests = await ConsultationRequest.find(filter)
      .populate("patient", "name username avatar")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ requests });
  } catch (err) {
    console.error("Get incoming error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ── GET /:id/messages — load chat ── */
router.get("/:id/messages", verifyUser, async (req, res) => {
  try {
    const request = await ConsultationRequest.findById(req.params.id)
      .populate("patient", "name username avatar")
      .populate("doctor",  "name username avatar");
    if (!request) return res.status(404).json({ message: "Consultation not found" });

    const uid = req.user._id.toString();
    if (request.patient._id.toString() !== uid && request.doctor._id.toString() !== uid)
      return res.status(403).json({ message: "Not authorized" });

    const messages = await Message.find({ consultationId: req.params.id })
      .populate("sender", "name username avatar role")
      .sort({ createdAt: 1 })
      .lean();

    res.json({ messages, request });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ── POST /:id/messages — send a chat message ── */
router.post("/:id/messages", verifyUser, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Message text required" });

    const request = await ConsultationRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Consultation not found" });

    const uid = req.user._id.toString();
    if (request.patient.toString() !== uid && request.doctor.toString() !== uid)
      return res.status(403).json({ message: "Not authorized" });
    if (request.status !== "accepted")
      return res.status(403).json({ message: "Consultation is not active" });

    const msg = await Message.create({ consultationId: req.params.id, sender: req.user._id, text: text.trim() });
    await msg.populate("sender", "name username avatar role");
    res.status(201).json({ message: msg });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ── GET /incoming — doctor's received requests ── */
router.patch("/:id/respond", verifyUser, async (req, res) => {
  try {
    if (req.user.role !== "doctor") return res.status(403).json({ message: "Doctors only" });

    const { status, doctorNote } = req.body;
    if (!["accepted", "declined"].includes(status))
      return res.status(400).json({ message: "status must be accepted or declined" });

    const request = await ConsultationRequest.findOne({ _id: req.params.id, doctor: req.user._id })
      .populate("patient", "name username email isOnline")
      .populate("doctor",  "name username");
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== "pending") return res.status(409).json({ message: "Already responded" });

    request.status     = status;
    request.doctorNote = doctorNote?.trim() || "";
    await request.save();

    if (status === "accepted") {
      // 1 — start or reuse a conversation between doctor and patient
      const Conversation = (await import("../models/Conversation.js")).default;
      let convo = await Conversation.findOne({
        participants: { $all: [req.user._id, request.patient._id], $size: 2 }
      });
      if (!convo) {
        convo = await Conversation.create({ participants: [req.user._id, request.patient._id] });
      }
      const conversationId = convo._id.toString();

      // 2 — notify patient via socket with conversationId so frontend can redirect
      const io = req.app.get("io");
      io.to(`user:${request.patient._id}`).emit("consultation:accepted", {
        conversationId,
        doctorName: req.user.name,
        requestId:  request._id,
      });

      // 3 — also redirect doctor to same conversation
      io.to(`user:${req.user._id}`).emit("consultation:accepted", {
        conversationId,
        doctorName: req.user.name,
        requestId:  request._id,
      });

      // 4 — notification bell for patient
      const notifMsg = request.patient.isOnline
        ? `Dr. ${req.user.name} accepted your consultation. Click to start chatting.`
        : `Dr. ${req.user.name} accepted your consultation request. Come online to start chatting — the doctor is waiting!`;

      await createNotification(
        request.patient._id,
        "consultation_response",
        "✅ Consultation Accepted",
        notifMsg,
        { conversationId, requestId: request._id, doctorId: req.user._id }
      );

      return res.json({ message: "Request accepted", request, conversationId });
    }

    // declined path
    await createNotification(
      request.patient._id,
      "consultation_response",
      "❌ Consultation Declined",
      `Dr. ${req.user.name} declined your request.${request.doctorNote ? ` Reason: ${request.doctorNote}` : ""}`,
      { requestId: request._id, doctorId: req.user._id }
    );

    res.json({ message: "Request declined", request });
  } catch (err) {
    console.error("Respond consultation error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ── PATCH /:id/close — patient closes ── */
router.patch("/:id/close", verifyUser, async (req, res) => {
  try {
    const request = await ConsultationRequest.findOne({ _id: req.params.id, patient: req.user._id });
    if (!request) return res.status(404).json({ message: "Request not found" });
    request.status = "closed";
    await request.save();
    res.json({ message: "Request closed" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});



export default router;