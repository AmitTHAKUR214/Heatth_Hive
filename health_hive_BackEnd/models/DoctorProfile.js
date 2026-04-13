import mongoose from "mongoose";

const doctorProfileSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    fullName:       { type: String, required: true },
    specialty:      { type: String, required: true },
    qualification:  { type: String, required: true }, // e.g. MBBS, MD
    registrationNo: { type: String, required: true }, // medical council reg number
    hospitalName:   { type: String },
    phone:          { type: String },
    city:           { type: String },

    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },

    rejectionReason:         { type: String, default: "" },
    reVerificationRequested: { type: Boolean, default: false },
    availableForConsultation: { type: Boolean, default: false },

    documents: {
      medicalDegree: {
        url:    String,
        status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
      },
      registrationCertificate: {
        url:    String,
        status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
      },
      governmentId: {
        url:    String,
        status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model("DoctorProfile", doctorProfileSchema);