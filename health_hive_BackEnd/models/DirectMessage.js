import mongoose from "mongoose";

const directMessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // encrypted ciphertext stored here instead of plain text
  text: {
    type: String,
    trim: true,
    maxlength: 8000, // larger to accommodate encryption overhead
  },
  iv: {
    type: String, // AES-GCM initialization vector
  },
  type: {
    type: String,
    enum: ["text", "system", "media_signal"],
    default: "text",
  },
  attachments: [{
    url:  String,
    name: String,
    size: Number,
    mimeType: String,
  }],
  readBy:     [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  // TTL field — MongoDB auto-deletes when this date passes
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    index: { expireAfterSeconds: 0 }, // TTL index
  },
}, { timestamps: true });

directMessageSchema.index({ conversationId: 1, createdAt: 1 });

export default mongoose.model("DirectMessage", directMessageSchema);