import mongoose from "mongoose";

const PharmacySubscriberSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacy",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "left"],
      default: "active",
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

PharmacySubscriberSchema.index({ pharmacyId: 1, userId: 1 }, { unique: true });

export default mongoose.model("PharmacySubscriber", PharmacySubscriberSchema);