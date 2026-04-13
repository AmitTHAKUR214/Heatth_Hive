import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import multer from "multer";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import compression from "compression";
import User from "./models/User.js";

dotenv.config();

// Routes
import authRoute           from "./routes/authroutes.js";
import SpacesRoute         from "./routes/Spaceroutes.js";
import questionsRoute      from "./routes/questionroutes.js";
import PostsRoute          from "./routes/postRoutes.js";
import feedRoute           from "./routes/feedroutes.js";
import searchRoute         from "./routes/searchroutes.js";
import inventoryRoutes     from "./routes/inventoryRoutes.js";
import pharmacistRoutes    from "./routes/pharmacistroutes.js";
import medicineSearchRoutes from "./routes/medicinesearchRoutes.js";
import notificationRoutes  from "./routes/notificationRoutes.js";
import pharmacyMapRoutes   from "./routes/medisineSearchByPharmacyRoutes.js";
import pharmacyDiscoveryRoutes from "./routes/pharmacyDiscoveryRoutes.js";
import adminRoutes         from "./routes/adminRoutes.js";
import adminAuthRoutes     from "./routes/adminAuthRoutes.js";
import contentRoutes       from "./routes/contentinteractionRoutes.js";
import commentRoutes       from "./routes/commentRoutes.js";
import userProfileRoutes   from "./routes/userProfile.js";
import doctorRoutes        from "./routes/doctorRoutes.js";
import consultationRoutes  from "./routes/consultationRoutes.js";
import messageRoutes       from "./routes/messageRoutes.js";

// Ensure models are registered
import "./models/Message.js";
import "./models/Conversation.js";
import "./models/DirectMessage.js";
import "./models/Block.js";
import "./models/PharmacySubscriber.js";
import "./models/MedicineBooking.js";


const app    = express();
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
  "http://localhost:5173",
  "http://localhost:4173",
];

const server = createServer(app);
const io     = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
});

// make io accessible in routes via req.app.get("io")
app.set("io", io);
// make io accessible in services
global._io = io;

/* ── CORS ── */
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

/* ── Core middleware ── */
app.use(compression()); // gzip all responses
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── Static uploads ── */
const uploadsBase = path.join(path.resolve(), "uploads");
app.use("/uploads",                express.static(path.join(uploadsBase, "pharmacistsData")));
app.use("/uploads/pharmacistsData", express.static(path.join(uploadsBase, "pharmacistsData")));
app.use("/uploads/posts",          express.static(path.join(uploadsBase, "posts")));
app.use("/uploads/questions",      express.static(path.join(uploadsBase, "questions")));
app.use("/uploads/avatars",        express.static(path.join(uploadsBase, "avatars")));
app.use("/uploads/messages", express.static(path.join(uploadsBase, "messages")));

/* ── API Routes ── */
app.use("/api/auth",              authRoute);
app.use("/api/spaces",            SpacesRoute);
app.use("/api/questions",         questionsRoute);
app.use("/api/posts",             PostsRoute);
app.use("/api/feed",              feedRoute);
app.use("/api/search",            searchRoute);
app.use("/api/inventory",         inventoryRoutes);
app.use("/api/pharmacist",        pharmacistRoutes);
app.use("/api/pharmacies", pharmacyDiscoveryRoutes);

app.use("/api/medicinesearch",    medicineSearchRoutes);
app.use("/api/notifications",     notificationRoutes);
app.use("/api/public/pharmacies", pharmacyMapRoutes);
app.use("/api/admin",             adminRoutes);
app.use("/api/admin/auth",        adminAuthRoutes);
app.use("/api/users",             userProfileRoutes);
app.use("/api/content",           contentRoutes);
app.use("/api/comments",          commentRoutes);
app.use("/api/doctor",            doctorRoutes);
app.use("/api/consultations",     consultationRoutes);
app.use("/api/messages",          messageRoutes);

/* ── Socket.io ── */
// auth middleware — verify JWT on connection
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.userId).select("_id name username role");
    if (!user) return next(new Error("User not found"));
    socket.user = user;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", async (socket) => {
  const userId = socket.user._id.toString();

  // ── Presence: mark online ──
  await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
  socket.broadcast.emit("user:online", { userId });

  // join personal room for notifications/requests
  socket.join(`user:${userId}`);

  // ── DM room join ──
  socket.on("dm:join", (roomId) => { socket.join(roomId); });
  socket.on("dm:leave", (roomId) => { socket.leave(roomId); });

  // ── Conversation rooms (WhatsApp-style DM) ──
  socket.on("convo:join",  (id) => socket.join(`convo:${id}`));
  socket.on("convo:leave", (id) => socket.leave(`convo:${id}`));

  // ── Consultation room ──
  socket.on("consultation:join",  (id) => socket.join(`consult:${id}`));
  socket.on("consultation:leave", (id) => socket.leave(`consult:${id}`));

  // ── WebRTC signaling ──
  socket.on("webrtc:offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("webrtc:offer", { offer, from: userId });
  });
  socket.on("webrtc:answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("webrtc:answer", { answer, from: userId });
  });
  socket.on("webrtc:ice", ({ roomId, candidate }) => {
    socket.to(roomId).emit("webrtc:ice", { candidate, from: userId });
  });

  // ── DM request events ──
  socket.on("dm:notify_request", ({ receiverId, request }) => {
    io.to(`user:${receiverId}`).emit("dm:incoming_request", { request });
  });

  // ── Presence: mark offline on disconnect ──
  socket.on("disconnect", async () => {
    await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
    socket.broadcast.emit("user:offline", { userId });
  });
});

/* ── Global error handler ── */
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message });
  }
  next();
});

/* ── Connect & Start ── */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    server.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => console.error("MongoDB error:", err));