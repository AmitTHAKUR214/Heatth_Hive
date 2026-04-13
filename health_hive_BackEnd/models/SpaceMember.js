import mongoose from "mongoose";

const SpaceMemberSchema = new mongoose.Schema(
  {
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    role: {
      type: String,
      enum: ["owner", "admin", "member"],
      default: "member",
    },

    status: {
      type: String,
      enum: ["active", "pending", "rejected", "left", "banned"],
      default: "active",
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },

    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// prevent duplicates
SpaceMemberSchema.index({ spaceId: 1, userId: 1 }, { unique: true });

export default mongoose.model("SpaceMember", SpaceMemberSchema);
