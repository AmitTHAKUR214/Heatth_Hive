// models/ContentInteraction.js
import mongoose from "mongoose";

const contentInteractionSchema = new mongoose.Schema(
  {
    contentType: {
      type: String,
      enum: ["post", "question", "answer", "comment"],
      required: true,
      index: true,
    },

    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    action: {
      type: String,
      enum: ["like", "dislike", "flag", "share"],
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// 🔒 One action per user per content
contentInteractionSchema.index(
  { contentType: 1, contentId: 1, userId: 1, action: 1 },
  { unique: true }
);

export default mongoose.model(
  "ContentInteraction",
  contentInteractionSchema
);
