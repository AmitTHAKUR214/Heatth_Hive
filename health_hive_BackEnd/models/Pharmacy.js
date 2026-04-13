import mongoose from "mongoose";

const pharmacySchema = new mongoose.Schema(
{
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },

  name: { type: String, required: true },
  address: { type: String, default: "" },
  email: { type: String },
  phone: { type: String },

  licenseNumber: { type: String },
  gstNumber: { type: String },

  location: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
      default: "Point",
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
    },
  },

  verificationStatus: {
    type: String,
    enum: ["pending", "verified", "rejected"],
    default: "pending",
  },

  documents: {
    pharmacyLicense: {
      url: String,
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
    },
    ownerIdProof: {
      url: String,
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
    },
    gstCertificate: {
      url: String,
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
    },
  },
},
{ timestamps: true }
);

pharmacySchema.index({ location: "2dsphere" });

export default mongoose.model("Pharmacy", pharmacySchema);