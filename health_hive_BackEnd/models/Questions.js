// models/Question.js
import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    images: [
      {
        path: { type: String },
        size: { type: Number },
      }
    ],
    // ─────────────────────────────────────────────────────────────
    // ADD THIS FIELD to both models/Posts.js and models/Questions.js
    // Place it alongside the other fields (e.g. after `postedBy`)
    // ─────────────────────────────────────────────────────────────

    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      default: null,
      index: true,   // ← important, makes space feed queries fast
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    method: {
      type: String,
      enum: ["guest", "user"],
      default: "user",
    },

    type: {
      type: String,
      default: "question",
      immutable: true,
    },

    stats: {
      likes: { type: Number, default: 0 },
      dislikes: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      flags: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
    },

    topics: [{ type: String, trim: true, lowercase: true }],
  },
  { timestamps: true }
);

// feed query: sort by newest, filter by topic/space
questionSchema.index({ createdAt: -1 });
questionSchema.index({ topics: 1, createdAt: -1 });
questionSchema.index({ spaceId: 1, createdAt: -1 });
questionSchema.index({ postedBy: 1, createdAt: -1 });

export default mongoose.model("Question", questionSchema);