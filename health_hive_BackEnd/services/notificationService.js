import Notification from "../models/Notification.js";

/**
 * createNotification — call this from any controller to fire a notification
 *
 * @param {string}   recipientId  — User _id
 * @param {string}   type         — enum from Notification model
 * @param {string}   title
 * @param {string}   message
 * @param {object}   meta         — optional extra data
 */
export const createNotification = async (recipientId, type, title, message, meta = {}) => {
  try {
    await Notification.create({ recipient: recipientId, type, title, message, meta });
    // push to recipient's socket room instantly
    global._io?.to(`user:${recipientId}`).emit("notification:new");
  } catch (err) {
    console.error("Notification create error:", err.message);
  }
};

/**
 * notifyLowStock — called from inventory save logic
 * Only fires if quantity just crossed the threshold (avoids spam)
 */
export const notifyLowStock = async (userId, medicineName, pharmacyName, quantity) => {
  const threshold = 10;
  if (quantity > threshold) return;

  const type    = quantity === 0 ? "out_of_stock" : "low_stock";
  const title   = quantity === 0 ? `⚠️ Out of stock: ${medicineName}` : `🔔 Low stock: ${medicineName}`;
  const message = quantity === 0
    ? `${medicineName} at ${pharmacyName} is now out of stock.`
    : `${medicineName} at ${pharmacyName} has only ${quantity} units left.`;

  await createNotification(userId, type, title, message, { medicineName, pharmacyName, quantity, threshold });
};

/**
 * notifyVerificationChange — called from adminRoutes approve/reject
 */
export const notifyVerificationChange = async (ownerId, status, pharmacyName, reason = "") => {
  const map = {
    verified: {
      type:    "verification_approved",
      title:   "✅ Pharmacy Approved",
      message: `Your pharmacy "${pharmacyName}" has been verified. You can now manage your inventory.`,
    },
    rejected: {
      type:    "verification_rejected",
      title:   "❌ Verification Rejected",
      message: `Your pharmacy "${pharmacyName}" was rejected.${reason ? ` Reason: ${reason}` : ""}`,
    },
    reverification: {
      type:    "reverification_requested",
      title:   "🔄 Re-verification Requested",
      message: `Admin has requested you resubmit documents for "${pharmacyName}".${reason ? ` Reason: ${reason}` : ""}`,
    },
  };
  const n = map[status];
  if (!n) return;
  await createNotification(ownerId, n.type, n.title, n.message, { pharmacyName, reason });
};

/**
 * notifyDoctorVerificationChange — called from adminRoutes for doctor approve/reject
 */
export const notifyDoctorVerificationChange = async (ownerId, status, doctorName, reason = "") => {
  const map = {
    verified: {
      type:    "verification_approved",
      title:   "✅ Doctor Profile Approved",
      message: `Your doctor profile has been verified. Your badge is now active.`,
    },
    rejected: {
      type:    "verification_rejected",
      title:   "❌ Doctor Verification Rejected",
      message: `Your doctor profile was rejected.${reason ? ` Reason: ${reason}` : ""}`,
    },
    reverification: {
      type:    "reverification_requested",
      title:   "🔄 Re-verification Requested",
      message: `Admin has requested you resubmit documents.${reason ? ` Reason: ${reason}` : ""}`,
    },
  };
  const n = map[status];
  if (!n) return;
  await createNotification(ownerId, n.type, n.title, n.message, { doctorName, reason });
};

/**
 * notifyAdminAnnouncement — broadcast to all users of a given role (or all)
 * Pass an array of recipientIds to target specific users
 */
export const notifyAnnouncement = async (recipientIds, title, message) => {
  try {
    const docs = recipientIds.map((id) => ({
      recipient: id,
      type:      "admin_announcement",
      title,
      message,
      meta:      {},
    }));
    await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    console.error("Announcement error:", err.message);
  }
};