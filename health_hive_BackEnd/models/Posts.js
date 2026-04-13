// models/Post.js
import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
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
      index: true,
    },

    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    visibility: {
      type: String,
      enum: ["public", "private", "unlisted"],
      default: "public",
    },

    type: {
      type: String,
      default: "post",
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
postSchema.index({ createdAt: -1 });
postSchema.index({ topics: 1, createdAt: -1 });
postSchema.index({ spaceId: 1, createdAt: -1 });
postSchema.index({ postedBy: 1, createdAt: -1 });

export default mongoose.model("Post", postSchema);