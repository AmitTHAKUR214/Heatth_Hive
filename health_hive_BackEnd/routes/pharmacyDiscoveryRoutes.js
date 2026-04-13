import express from "express";
import Pharmacy from "../models/Pharmacy.js";
import PharmacySubscriber from "../models/PharmacySubscriber.js";
import MedicineBooking from "../models/MedicineBooking.js";
import { verifyUser } from "../middleware/auth.js";
import { createNotification } from "../services/notificationService.js";

const router = express.Router();

function calcDistKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── GET /nearby ── */
router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng, radius = 2500 } = req.query;
    if (!lat || !lng)
      return res.status(400).json({ message: "lat and lng are required" });

    const radiusMeters = Math.min(Number(radius), 10000);

    const pharmacies = await Pharmacy.find({
      verificationStatus: "verified",
      location: {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [Number(lng), Number(lat)] },
          $maxDistance: radiusMeters,
        },
      },
    })
      .populate("owner", "name username")
      .select("name address email phone location verificationStatus owner")
      .limit(30)
      .lean();

    const ids = pharmacies.map((p) => p._id);

    const subCounts = await PharmacySubscriber.aggregate([
      { $match: { pharmacyId: { $in: ids }, status: "active" } },
      { $group: { _id: "$pharmacyId", count: { $sum: 1 } } },
    ]);
    const subMap = Object.fromEntries(subCounts.map((s) => [s._id.toString(), s.count]));

    // inventory stats from Inventory model (items array, field: medicineName + quantity)
    let stockMap = {};
    try {
      const Inventory = (await import("../models/Inventory.js")).default;
      const ownerIds = pharmacies.map((p) => p.owner?._id).filter(Boolean);
      const stocks = await Inventory.aggregate([
        { $match: { owner: { $in: ownerIds } } },
        { $unwind: "$items" },
        {
          $group: {
            _id:      "$owner",
            total:    { $sum: 1 },
            lowStock: { $sum: { $cond: [{ $lte: ["$items.quantity", 5] }, 1, 0] } },
          },
        },
      ]);
      stockMap = Object.fromEntries(stocks.map((s) => [s._id.toString(), s]));
    } catch { /* non-fatal */ }

    const result = pharmacies.map((p) => {
      const [pLng, pLat] = p.location.coordinates;
      const distKm = calcDistKm(Number(lat), Number(lng), pLat, pLng);
      const stock  = stockMap[p.owner?._id?.toString()] || { total: 0, lowStock: 0 };
      return {
        ...p,
        distanceKm:      Math.round(distKm * 10) / 10,
        subscriberCount: subMap[p._id.toString()] || 0,
        totalMedicines:  stock.total,
        lowStockCount:   stock.lowStock,
      };
    });

    res.json({ pharmacies: result });
  } catch (err) {
    console.error("Nearby pharmacies error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ── POST /:id/subscribe ── */
router.post("/:id/subscribe", verifyUser, async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: "Pharmacy not found" });
    if (pharmacy.verificationStatus !== "verified")
      return res.status(403).json({ message: "Pharmacy is not verified" });

    const existing = await PharmacySubscriber.findOne({ pharmacyId: req.params.id, userId: req.user._id });

    if (existing) {
      if (existing.status === "active") return res.status(409).json({ message: "Already subscribed" });
      existing.status = "active";
      existing.subscribedAt = new Date();
      await existing.save();
      return res.json({ message: "Re-subscribed", subscribed: true });
    }

    await PharmacySubscriber.create({ pharmacyId: req.params.id, userId: req.user._id });

    await createNotification(pharmacy.owner, "pharmacy_subscriber", "🔔 New Subscriber",
      `${req.user.name} subscribed to your pharmacy.`,
      { userId: req.user._id, pharmacyId: pharmacy._id }
    );

    res.status(201).json({ message: "Subscribed", subscribed: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ── DELETE /:id/subscribe ── */
router.delete("/:id/subscribe", verifyUser, async (req, res) => {
  try {
    const sub = await PharmacySubscriber.findOne({ pharmacyId: req.params.id, userId: req.user._id, status: "active" });
    if (!sub) return res.status(404).json({ message: "Not subscribed" });
    sub.status = "left";
    await sub.save();
    res.json({ message: "Unsubscribed", subscribed: false });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ── GET /:id/subscription-status ── */
router.get("/:id/subscription-status", verifyUser, async (req, res) => {
  try {
    const sub = await PharmacySubscriber.findOne({ pharmacyId: req.params.id, userId: req.user._id });
    res.json({ subscribed: sub?.status === "active" || false });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ── GET /:id/inventory — subscribers only ── */
router.get("/:id/inventory", verifyUser, async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id).populate("owner", "_id");
    if (!pharmacy) return res.status(404).json({ message: "Pharmacy not found" });

    const isOwner = pharmacy.owner._id.toString() === req.user._id.toString();
    if (!isOwner) {
      const sub = await PharmacySubscriber.findOne({ pharmacyId: req.params.id, userId: req.user._id, status: "active" });
      if (!sub) return res.status(403).json({ message: "Subscribe to view inventory", requiresSubscription: true });
    }

    const Inventory = (await import("../models/Inventory.js")).default;
    const inventoryDoc = await Inventory.findOne({ owner: pharmacy.owner._id }).lean();
    const items = inventoryDoc?.items || [];

    // attach any active booking this user has per item
    const bookings = await MedicineBooking.find({
      userId:     req.user._id,
      pharmacyId: req.params.id,
      status:     { $in: ["pending", "ready"] },
    }).lean();
    const bookedMap = Object.fromEntries(bookings.map((b) => [b.inventoryItemId?.toString(), b]));

    const enriched = items.map((item) => ({
      ...item,
      userBooking: bookedMap[item._id?.toString()] || null,
    }));

    res.json({ items: enriched, pharmacy });
  } catch (err) {
    console.error("Inventory fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ── static booking routes BEFORE /:id ── */

/* GET /bookings/mine */
router.get("/bookings/mine", verifyUser, async (req, res) => {
  try {
    const bookings = await MedicineBooking.find({ userId: req.user._id, status: { $in: ["pending", "ready"] } })
      .populate("pharmacyId", "name address phone")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* PATCH /bookings/:bookingId/cancel */
router.patch("/bookings/:bookingId/cancel", verifyUser, async (req, res) => {
  try {
    const booking = await MedicineBooking.findOne({
      _id: req.params.bookingId, userId: req.user._id, status: { $in: ["pending", "ready"] },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found or already completed" });
    booking.status = "cancelled";
    await booking.save();
    res.json({ message: "Booking cancelled" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ── POST /:id/bookings ── */
router.post("/:id/bookings", verifyUser, async (req, res) => {
  try {
    const { inventoryItemId, quantity, note } = req.body;
    if (!inventoryItemId || !quantity || quantity < 1)
      return res.status(400).json({ message: "inventoryItemId and quantity required" });

    const pharmacy = await Pharmacy.findById(req.params.id).populate("owner", "_id name");
    if (!pharmacy) return res.status(404).json({ message: "Pharmacy not found" });

    const sub = await PharmacySubscriber.findOne({ pharmacyId: req.params.id, userId: req.user._id, status: "active" });
    if (!sub) return res.status(403).json({ message: "Subscribe first", requiresSubscription: true });

    const Inventory = (await import("../models/Inventory.js")).default;
    const inventoryDoc = await Inventory.findOne({ owner: pharmacy.owner._id });
    if (!inventoryDoc) return res.status(404).json({ message: "Inventory not found" });

    const item = inventoryDoc.items.id(inventoryItemId);
    if (!item) return res.status(404).json({ message: "Medicine not found in inventory" });

    const existingBookings = await MedicineBooking.aggregate([
      { $match: { inventoryItemId: item._id, status: { $in: ["pending", "ready"] } } },
      { $group: { _id: null, total: { $sum: "$quantity" } } },
    ]);
    const reserved  = existingBookings[0]?.total || 0;
    const available = item.quantity - reserved;
    if (quantity > available)
      return res.status(409).json({ message: `Only ${available} units available`, available });

    const dup = await MedicineBooking.findOne({
      userId: req.user._id, inventoryItemId: item._id, pharmacyId: req.params.id,
      status: { $in: ["pending", "ready"] },
    });
    if (dup) return res.status(409).json({ message: "You already have an active booking for this medicine" });

    const booking = await MedicineBooking.create({
      userId: req.user._id, pharmacyId: req.params.id,
      inventoryItemId: item._id, medicineName: item.medicineName,
      quantity, note: note?.trim() || "",
    });

    await createNotification(pharmacy.owner._id, "medicine_booking", "📦 New Medicine Booking",
      `${req.user.name} reserved ${quantity}× ${item.medicineName} for pickup.`,
      { bookingId: booking._id, userId: req.user._id }
    );

    res.status(201).json({ message: "Booking confirmed", booking });
  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ── GET /:id/bookings — pharmacist view ── */
router.get("/:id/bookings", verifyUser, async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: "Pharmacy not found" });
    if (pharmacy.owner.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not your pharmacy" });

    const { status } = req.query;
    const filter = { pharmacyId: req.params.id };
    if (status) filter.status = status;

    const bookings = await MedicineBooking.find(filter)
      .populate("userId", "name username phone")
      .sort({ createdAt: -1 }).lean();

    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ── PATCH /:id/bookings/:bookingId/status — pharmacist updates ── */
router.patch("/:id/bookings/:bookingId/status", verifyUser, async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy || pharmacy.owner.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized" });

    const { status } = req.body;
    if (!["ready", "picked_up", "cancelled"].includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const booking = await MedicineBooking.findById(req.params.bookingId).populate("userId", "_id name");
    if (!booking || booking.pharmacyId.toString() !== req.params.id)
      return res.status(404).json({ message: "Booking not found" });

    booking.status = status;
    await booking.save();

    const labels = { ready: "✅ Ready for Pickup", picked_up: "🏁 Pickup Complete", cancelled: "❌ Booking Cancelled" };
    await createNotification(booking.userId._id, "booking_update", labels[status],
      `Your booking at ${pharmacy.name} is now: ${status.replace("_", " ")}.`,
      { bookingId: booking._id, pharmacyId: pharmacy._id }
    );

    res.json({ message: `Booking marked ${status}`, booking });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;