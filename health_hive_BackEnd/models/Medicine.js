// models/Medicine.js
import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    brand: {
      type: String,
      trim: true,
    },

    category: {
      type: String, // Tablet, Syrup, Injection
      trim: true,
    },

    strength: {
      type: String, // 500mg, 250mg/5ml
      trim: true,
    },

    batchNumber: {
      type: String,
      trim: true,
    },

    expiryDate: {
      type: Date,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    mrp: {
      type: Number,
      required: true,
      min: 0,
    },

    costPrice: {
      type: Number, // optional
      min: 0,
    },

    supplier: {
      type: String, // optional
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Medicine", medicineSchema);
