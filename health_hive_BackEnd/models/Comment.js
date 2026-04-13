import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    contentType: {
      type: String,
      enum: ["post", "question", "comment"],
      required: true,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    stats: {
      likes:    { type: Number, default: 0 },
      dislikes: { type: Number, default: 0 },
      replies:  { type: Number, default: 0 },
      flags:    { type: Number, default: 0 },
    },
    // track who reacted so one user = one reaction
    likedBy:    [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dislikedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Comment", commentSchema);