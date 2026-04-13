import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
  // exactly 2 participants always
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  }],

  // last message snapshot for inbox display
  lastMessage: {
    text:      { type: String, default: "" },
    sender:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sentAt:    { type: Date },
    isMedia:   { type: Boolean, default: false },
  },

  // unread count per participant — { userId: count }
  unreadCount: {
    type: Map,
    of: Number,
    default: {},
  },

  // soft deletes per participant — if deleted, they won't see old messages
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],

  // muted participants — no notifications
  mutedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],

}, { timestamps: true });

// fast lookup: find conversation between two users
conversationSchema.index({ participants: 1 });
// inbox query: all conversations for a user, sorted by latest
conversationSchema.index({ participants: 1, "lastMessage.sentAt": -1 });

export default mongoose.model("Conversation", conversationSchema);