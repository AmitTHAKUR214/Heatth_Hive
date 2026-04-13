import mongoose from "mongoose";

const inventoryItemSchema = new mongoose.Schema(
  {
    medicineName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    brand: { type: String, trim: true },
    quantity: { type: Number, default: 0 },
    price: { type: Number },
    expiry: { type: Date },
  },
  { _id: false }
);

const inventorySchema = new mongoose.Schema(
  {
    pharmacist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    items: [inventoryItemSchema],
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Inventory", inventorySchema);