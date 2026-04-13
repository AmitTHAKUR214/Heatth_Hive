import Inventory from "../models/Inventory.js";

/**
 * GET /api/medicinesearch/medicines?q=paracetamol
 *
 * ✅ FIX: Was querying the Medicine model — but pharmacists save their stock
 * to the Inventory model (items[].medicineName). Medicine model is a separate
 * catalog that nothing writes to. Querying it always returns empty.
 *
 * Now aggregates across ALL pharmacist inventories to find matching medicine
 * names, deduplicates, and returns a clean list for the search autocomplete.
 */
export const searchMedicines = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: "Query too short" });
    }

    const results = await Inventory.aggregate([
      // Flatten all items arrays across all pharmacist inventories
      { $unwind: "$items" },

      // Match medicine names containing the query (case-insensitive)
      {
        $match: {
          "items.medicineName": { $regex: q.trim(), $options: "i" },
          "items.quantity": { $gt: 0 }, // only in-stock medicines
        },
      },

      // Group by name to deduplicate
      {
        $group: {
          _id: { $toLower: "$items.medicineName" },
          medicineName: { $first: "$items.medicineName" },
        },
      },

      // Sort alphabetically
      { $sort: { medicineName: 1 } },

      // Limit suggestions to 10
      { $limit: 10 },

      { $project: { _id: 0, name: "$medicineName" } },
    ]);

    res.json(results); // [{ name: "Paracetamol" }, { name: "Paracetamol Syrup" }]
  } catch (err) {
    console.error("Medicine search error:", err);
    res.status(500).json({ message: "Search failed" });
  }
};