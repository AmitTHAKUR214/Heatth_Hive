import mongoose from "mongoose";

const spaceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: String,
    icon: String,

    // Add this field to your Space.js model schema, alongside the other fields:

    theme: {
      primary:    { type: String, default: "#4f46e5" },
      accent:     { type: String, default: "#22c55e" },
      background: { type: String, default: "#f8fafc" },
    },
    
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public"
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },

    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending"
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    admins: [
      {
        id: { type: String, required: true },
        name: String,
        avatar: String
      }
    ],

    members: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }]

  },
  { timestamps: true }
);


const Space = mongoose.model("Space", spaceSchema);
export default Space;
