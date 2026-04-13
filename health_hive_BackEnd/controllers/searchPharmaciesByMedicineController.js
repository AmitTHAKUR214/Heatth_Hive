import Pharmacy from "../models/Pharmacy.js";
import Inventory from "../models/Inventory.js";

export const searchPharmaciesByMedicine = async (req, res) => {
  try {
    const { lat, lon, radius, medicine } = req.query;

    if (!lat || !lon || !medicine) {
      return res.status(400).json({ message: "Missing params: lat, lon, medicine required" });
    }

    const maxDistance = parseInt(radius) || 2500;

    // ✅ FIX 1: Query Pharmacy model (has 2dsphere index + verificationStatus)
    // ✅ FIX 2: Pharmacy model is flat — no "shop" wrapper
    // ✅ FIX 3: Join to Inventory via pharmacy owner (_id)
    const results = await Pharmacy.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(lon), parseFloat(lat)],
          },
          distanceField: "distance",
          maxDistance: maxDistance,
          spherical: true,
          query: {
            verificationStatus: "verified", // ✅ flat field, not shop.verificationStatus
          },
        },
      },

      // Join inventory using pharmacy owner (_id)
      {
        $lookup: {
          from: "inventories",
          localField: "owner",   // ✅ Pharmacy.owner = User._id = Inventory.pharmacist
          foreignField: "pharmacist",
          as: "inventory",
        },
      },

      { $unwind: "$inventory" },

      // Filter: pharmacy must have the medicine in stock
      {
        $match: {
          "inventory.items": {
            $elemMatch: {
              medicineName: { $regex: medicine, $options: "i" },
              quantity: { $gt: 0 },
            },
          },
        },
      },

      // ✅ FIX 3: Project flat Pharmacy fields (no "shop." prefix)
      {
        $project: {
          _id: 1,
          name: 1,
          address: 1,
          location: 1,       // { type: "Point", coordinates: [lng, lat] }
          distance: 1,
          phone: 1,
          // Pull matching medicine items for display
          matchedItems: {
            $filter: {
              input: "$inventory.items",
              as: "item",
              cond: {
                $and: [
                  { $regexMatch: { input: "$$item.medicineName", regex: medicine, options: "i" } },
                  { $gt: ["$$item.quantity", 0] }
                ]
              }
            }
          }
        },
      },
    ]);

    res.json(results);
  } catch (err) {
    console.error("searchPharmaciesByMedicine error:", err);
    res.status(500).json({ message: "Server error" });
  }
};