import Pharmacy from "../models/Pharmacy.js";
import DoctorProfile from "../models/DoctorProfile.js";
import User from "../models/User.js";
import { notifyVerificationChange, notifyDoctorVerificationChange } from "../services/notificationService.js";

export const getStats = async (req, res) => {
  try {
    const [
      totalPharmacies, pendingPharmacies, verifiedPharmacies, rejectedPharmacies,
      totalUsers, bannedUsers, recentPharmacies,
      profilesDoctors, pendingDoctors, verifiedDoctors, rejectedDoctors, totalDoctorUsers,
    ] = await Promise.all([
      Pharmacy.countDocuments(),
      Pharmacy.countDocuments({ verificationStatus: "pending" }),
      Pharmacy.countDocuments({ verificationStatus: "verified" }),
      Pharmacy.countDocuments({ verificationStatus: "rejected" }),
      User.countDocuments({ role: { $nin: ["guest", "admin"] } }),
      User.countDocuments({ role: { $nin: ["guest", "admin"] }, isBanned: true }),
      Pharmacy.find().sort({ createdAt: -1 }).limit(5).populate("owner", "name email"),
      DoctorProfile.countDocuments(),
      DoctorProfile.countDocuments({ verificationStatus: "pending" }),
      DoctorProfile.countDocuments({ verificationStatus: "verified" }),
      DoctorProfile.countDocuments({ verificationStatus: "rejected" }),
      User.countDocuments({ role: "doctor" }),
    ]);
    res.json({
      pharmacies: { total: totalPharmacies, pending: pendingPharmacies, verified: verifiedPharmacies, rejected: rejectedPharmacies },
      users: { total: totalUsers, banned: bannedUsers },
      doctors: { total: totalDoctorUsers, pending: pendingDoctors, verified: verifiedDoctors, rejected: rejectedDoctors, profilesSubmitted: profilesDoctors },
      recentPharmacies,
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};

/* ── Pharmacists ── */
export const getPharmacists = async (req, res) => {
  try {
    const { status } = req.query;
    const pharmacistUsers = await User.find({ role: "pharmacist" }).select("name email username createdAt").sort({ createdAt: -1 });
    const profiles = await Pharmacy.find({}).select("-__v");
    const profileByOwner = Object.fromEntries(profiles.map(p => [p.owner.toString(), p]));
    let results = pharmacistUsers.map(u => {
      const profile = profileByOwner[u._id.toString()] || null;
      return {
        ...(profile ? profile.toObject() : { _id: null, owner: u._id, name: null, address: null, verificationStatus: null, documents: {} }),
        owner: { _id: u._id, name: u.name, email: u.email, username: u.username, createdAt: u.createdAt },
        _profileId: profile?._id || null,
        hasProfile: !!profile,
      };
    });
    if (status && status !== "all") {
      results = status === "none" ? results.filter(r => !r.hasProfile) : results.filter(r => r.verificationStatus === status);
    }
    res.json({ pharmacists: results });
  } catch { res.status(500).json({ message: "Failed to fetch pharmacists" }); }
};

export const getPharmacist = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id).populate("owner", "name email createdAt");
    if (!pharmacy) return res.status(404).json({ message: "Pharmacy not found" });
    res.json({ pharmacy });
  } catch { res.status(500).json({ message: "Server error" }); }
};

export const approvePharmacist = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: "Pharmacy not found" });
    pharmacy.verificationStatus = "verified";
    pharmacy.rejectionReason = "";
    pharmacy.reVerificationRequested = false;
    await pharmacy.save();
    if (pharmacy.owner) await notifyVerificationChange(pharmacy.owner, "verified", pharmacy.name);
    res.json({ message: "Pharmacy approved", pharmacy });
  } catch { res.status(500).json({ message: "Server error" }); }
};

export const rejectPharmacist = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: "Pharmacy not found" });
    pharmacy.verificationStatus = "rejected";
    pharmacy.rejectionReason = req.body.reason || "No reason provided";
    pharmacy.reVerificationRequested = false;
    await pharmacy.save();
    if (pharmacy.owner) await notifyVerificationChange(pharmacy.owner, "rejected", pharmacy.name, pharmacy.rejectionReason);
    res.json({ message: "Pharmacy rejected", pharmacy });
  } catch { res.status(500).json({ message: "Server error" }); }
};

export const requestPharmacistReverification = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: "Pharmacy not found" });
    pharmacy.reVerificationRequested = true;
    pharmacy.rejectionReason = req.body.reason || "";
    await pharmacy.save();
    if (pharmacy.owner) await notifyVerificationChange(pharmacy.owner, "reverification", pharmacy.name, pharmacy.rejectionReason);
    res.json({ message: "Re-verification requested", pharmacy });
  } catch { res.status(500).json({ message: "Server error" }); }
};

export const updatePharmacistDocument = async (req, res) => {
  const { documentType, status } = req.body;
  try {
    const pharmacy = await Pharmacy.findById(req.params.pharmacyId);
    if (!pharmacy) return res.status(404).json({ message: "Pharmacy not found" });
    if (!pharmacy.documents?.[documentType]) return res.status(404).json({ message: "Document not found" });
    pharmacy.documents[documentType].status = status;
    await pharmacy.save();
    res.json({ message: `${documentType} ${status}`, pharmacy });
  } catch { res.status(500).json({ message: "Server error" }); }
};

/* ── Users ── */
export const getUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = { role: { $ne: "admin" } };
    if (search) filter.$or = [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }];
    const users = await User.find(filter).select("-password").sort({ createdAt: -1 });
    const userIds = users.map(u => u._id);
    const [pharmacies, doctorProfiles] = await Promise.all([
      Pharmacy.find({ owner: { $in: userIds } }).select("owner verificationStatus"),
      DoctorProfile.find({ owner: { $in: userIds } }).select("owner verificationStatus"),
    ]);
    const pharmacyMap = Object.fromEntries(pharmacies.map(p => [p.owner.toString(), p.verificationStatus]));
    const doctorMap   = Object.fromEntries(doctorProfiles.map(d => [d.owner.toString(), d.verificationStatus]));
    const enriched = users.map(u => {
      const obj = u.toJSON ? u.toJSON() : { ...u._doc };
      if (u.role === "pharmacist") obj.verificationStatus = pharmacyMap[u._id.toString()] || null;
      if (u.role === "doctor")     obj.verificationStatus = doctorMap[u._id.toString()]    || null;
      return obj;
    });
    res.json({ users: enriched });
  } catch { res.status(500).json({ message: "Failed to fetch users" }); }
};

export const banUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") return res.status(403).json({ message: "Cannot ban admin" });
    user.isBanned  = true;
    user.banReason = req.body.reason || "No reason provided";
    user.bannedAt  = new Date();
    await user.save();
    res.json({ message: "User banned" });
  } catch { res.status(500).json({ message: "Server error" }); }
};

export const unbanUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.isBanned = false;
    await user.save();
    res.json({ message: "User unbanned" });
  } catch { res.status(500).json({ message: "Server error" }); }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") return res.status(403).json({ message: "Cannot delete admin" });
    await user.deleteOne();
    res.json({ message: "User deleted" });
  } catch { res.status(500).json({ message: "Server error" }); }
};

/* ── Doctors ── */
export const getDoctors = async (req, res) => {
  try {
    const { status } = req.query;
    const doctorUsers = await User.find({ role: "doctor" }).select("name email username createdAt").sort({ createdAt: -1 });
    const profiles = await DoctorProfile.find({}).select("-__v");
    const profileByOwner = Object.fromEntries(profiles.map(d => [d.owner.toString(), d]));
    let results = doctorUsers.map(u => {
      const profile = profileByOwner[u._id.toString()] || null;
      return {
        ...(profile ? profile.toObject() : { _id: null, owner: u._id, fullName: u.name, specialty: null, qualification: null, registrationNo: null, verificationStatus: null, documents: {} }),
        owner: { _id: u._id, name: u.name, email: u.email, username: u.username, createdAt: u.createdAt },
        _profileId: profile?._id || null,
        hasProfile: !!profile,
      };
    });
    if (status && status !== "all") {
      results = status === "none" ? results.filter(r => !r.hasProfile) : results.filter(r => r.verificationStatus === status);
    }
    res.json({ doctors: results });
  } catch { res.status(500).json({ message: "Failed to fetch doctors" }); }
};

export const getDoctor = async (req, res) => {
  try {
    const doctor = await DoctorProfile.findById(req.params.id).populate("owner", "name email createdAt");
    if (!doctor) return res.status(404).json({ message: "Doctor profile not found" });
    res.json({ doctor });
  } catch { res.status(500).json({ message: "Server error" }); }
};

export const approveDoctor = async (req, res) => {
  try {
    const doctor = await DoctorProfile.findById(req.params.id);
    if (!doctor) return res.status(404).json({ message: "Doctor profile not found" });
    doctor.verificationStatus      = "verified";
    doctor.rejectionReason         = "";
    doctor.reVerificationRequested = false;
    await doctor.save();
    await User.findByIdAndUpdate(doctor.owner, { isRoleVerified: true });
    if (doctor.owner) await notifyDoctorVerificationChange(doctor.owner, "verified", doctor.fullName);
    res.json({ message: "Doctor approved", doctor });
  } catch { res.status(500).json({ message: "Server error" }); }
};

export const rejectDoctor = async (req, res) => {
  try {
    const doctor = await DoctorProfile.findById(req.params.id);
    if (!doctor) return res.status(404).json({ message: "Doctor profile not found" });
    doctor.verificationStatus      = "rejected";
    doctor.rejectionReason         = req.body.reason || "No reason provided";
    doctor.reVerificationRequested = false;
    await doctor.save();
    await User.findByIdAndUpdate(doctor.owner, { isRoleVerified: false });
    if (doctor.owner) await notifyDoctorVerificationChange(doctor.owner, "rejected", doctor.fullName, doctor.rejectionReason);
    res.json({ message: "Doctor rejected", doctor });
  } catch { res.status(500).json({ message: "Server error" }); }
};

export const requestDoctorReverification = async (req, res) => {
  try {
    const doctor = await DoctorProfile.findById(req.params.id);
    if (!doctor) return res.status(404).json({ message: "Doctor profile not found" });
    doctor.reVerificationRequested = true;
    doctor.rejectionReason         = req.body.reason || "";
    await doctor.save();
    if (doctor.owner) await notifyDoctorVerificationChange(doctor.owner, "reverification", doctor.fullName, doctor.rejectionReason);
    res.json({ message: "Re-verification requested", doctor });
  } catch { res.status(500).json({ message: "Server error" }); }
};

export const updateDoctorDocument = async (req, res) => {
  const { documentType, status } = req.body;
  try {
    const doctor = await DoctorProfile.findById(req.params.doctorId);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    if (!doctor.documents?.[documentType]) return res.status(404).json({ message: "Document not found" });
    doctor.documents[documentType].status = status;
    await doctor.save();
    res.json({ message: `${documentType} ${status}`, doctor });
  } catch { res.status(500).json({ message: "Server error" }); }
};