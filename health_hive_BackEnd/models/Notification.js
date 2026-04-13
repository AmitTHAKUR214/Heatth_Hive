import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "low_stock",          // pharmacist — item below threshold
        "out_of_stock",       // pharmacist — item qty = 0
        "verification_approved",  // pharmacist — admin approved
        "verification_rejected",  // pharmacist — admin rejected
        "reverification_requested", // pharmacist — admin wants docs again
        "admin_announcement",
        "medicine_found",
        "consultation_request",
        "consultation_response",
        "dm_request",
        "dm_accepted",
        "dm_declined",
      ],
    },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    isRead:  { type: Boolean, default: false, index: true },
    // Optional metadata — flexible, varies by notification type
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// fast lookup: all notifications for a user, newest first
NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model("Notification", NotificationSchema);