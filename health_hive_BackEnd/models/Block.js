import mongoose from "mongoose";

const blockSchema = new mongoose.Schema({
  blocker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  blocked: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
}, { timestamps: true });

// prevent duplicate blocks
blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
// check if someone is blocked quickly
blockSchema.index({ blocked: 1 });

export default mongoose.model("Block", blockSchema);