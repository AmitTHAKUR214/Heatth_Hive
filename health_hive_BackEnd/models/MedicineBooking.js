import mongoose from "mongoose";

const MedicineBookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacy",
      required: true,
      index: true,
    },
    // references the subdocument _id inside Inventory.items[]
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    // denormalized so we can show name even if inventory changes
    medicineName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["pending", "ready", "picked_up", "cancelled", "expired"],
      default: "pending",
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    // TTL: MongoDB auto-deletes 0 seconds after this date (24h from creation)
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

MedicineBookingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("MedicineBooking", MedicineBookingSchema);