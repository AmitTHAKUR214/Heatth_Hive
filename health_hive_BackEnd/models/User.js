import mongoose from "mongoose";

// const shopSchema = new mongoose.Schema(  this becomes not needed as we have officialy moved on to pharmacy.js
//   {
//     name: { type: String, required: true, trim: true },
//     address: { type: String, required: true, trim: true },
//     email: { type: String, trim: true },
//     phone: { type: String, trim: true },
//     licenseNumber: { type: String, trim: true },
//     gstNumber: { type: String, trim: true },

//     // ✅ REQUIRED FOR MAP SEARCH
//     location: {
//       type: {
//         type: String,
//         enum: ["Point"],
//         default: "Point",
//         required: true,
//       },
//       coordinates: {
//         type: [Number], // [lng, lat]
//         required: true,
//         validate: {
//           validator: function (val) {
//             return val.length === 2;
//           },
//           message: "Coordinates must be [lng, lat]",
//         },
//       },
//     },

//     setupCompleted: {
//       type: Boolean,
//       default: false,
//     },

//     verificationStatus: {
//       type: String,
//       enum: ["unverified", "pending", "verified", "rejected"],
//       default: "unverified",
//     },

//     documents: {
//       pharmacyLicense: {
//         url: String,
//         uploadedAt: Date,
//         status: {
//           type: String,
//           enum: ["pending", "approved", "rejected"],
//           default: "pending",
//         },
//       },
//       ownerIdProof: {
//         url: String,
//         uploadedAt: Date,
//         status: {
//           type: String,
//           enum: ["pending", "approved", "rejected"],
//           default: "pending",
//         },
//       },
//       gstCertificate: {
//         url: String,
//         uploadedAt: Date,
//         status: {
//           type: String,
//           enum: ["pending", "approved", "rejected"],
//           default: "pending",
//         },
//       },
//     },
//   },
//   { _id: false }
// );

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Anonymous", trim: true },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9._]+$/,
      index: true,
    },
    email: { type: String, unique: true, sparse: true, lowercase: true },
    password: String,

    role: {
      type: String,
      enum: ["guest", "user", "student", "doctor", "pharmacist"],
      required: true,
    },

    avatar: { type: String, default: "/default-avatar.png" },
    bio: { type: String, default: "" },

    isEmailVerified: { type: Boolean, default: false },
    isRoleVerified: { type: Boolean, default: false },

    emailVerifyToken: String,
    emailVerifyExpires: Date,

    guestId: String,

    isBanned:   { type: Boolean, default: false },
    banReason:  { type: String,  default: "" },
    bannedAt:   { type: Date },
    lastSeen:   { type: Date },
    isOnline:   { type: Boolean, default: false },
    inChat:     { type: Boolean, default: false },

    // shop: {
    //   type: shopSchema,
    //   default: undefined,
    // },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
      },
    },
  }
);

// ✅ REQUIRED FOR GEO SEARCH
// UserSchema.index({ "shop.location": "2dsphere" });

// indexes for hot queries
UserSchema.index({ role: 1 });
UserSchema.index({ isOnline: 1, role: 1 });          // /online query
UserSchema.index({ lastSeen: -1, role: 1 });          // presence fallback
UserSchema.index({ isBanned: 1, role: 1 });

export default mongoose.model("User", UserSchema);