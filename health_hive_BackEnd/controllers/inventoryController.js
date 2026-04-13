import Inventory from "../models/Inventory.js";
import Pharmacy from "../models/Pharmacy.js";           // ✅ needed for pharmacy name lookup
import { notifyLowStock } from "../services/notificationService.js";
import csv from "csvtojson";

const FIELD_ALIASES = {
  medicineName: ["medicinename", "drugname", "itemname", "productname", "description", "name", "item"],
  brand:        ["brand", "brandname", "manufacturer", "company", "mfg", "pharma"],
  quantity:     ["quantity", "qty", "qtyavailable", "stock", "balance", "available"],
  price:        ["price", "mrp", "mrp₹", "rate", "cost", "amount"],
  expiry:       ["expiry", "exp", "expdate", "expirydate", "expiration", "expiry(mm/yyyy)"],
};

// ✅ Shared helper — fires low-stock notifications after any inventory save
// Placed here, called inside both upsertInventory and uploadInventoryCSV
const triggerStockNotifications = async (userId, items) => {
  try {
    const pharmacy     = await Pharmacy.findOne({ owner: userId });
    const pharmacyName = pharmacy?.name || "Your pharmacy";
    for (const item of items) {
      await notifyLowStock(userId, item.medicineName, pharmacyName, item.quantity);
    }
  } catch (err) {
    console.error("Stock notification error:", err.message);
  }
};

/** GET pharmacist inventory */
export const getMyInventory = async (req, res) => {
  try {
    const inventory = await Inventory.findOne({ pharmacist: req.user._id });
    res.json(inventory || { items: [], lastUpdatedAt: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch inventory" });
  }
};

/** GET inventory summary */
export const getInventorySummary = async (req, res) => {
  try {
    const inventory = await Inventory.findOne({ pharmacist: req.user._id }).select("items");
    if (!inventory || !inventory.items) return res.json({ totalMedicines: 0, lowStock: 0 });

    const LOW_STOCK_LIMIT = 7;
    return res.json({
      totalMedicines: inventory.items.length,
      lowStock: inventory.items.filter((item) => item.quantity < LOW_STOCK_LIMIT).length,
    });
  } catch (error) {
    console.error("Inventory summary error:", error);
    res.status(500).json({ message: "Failed to fetch inventory summary" });
  }
};

/** CREATE / UPDATE inventory (manual) */
export const upsertInventory = async (req, res) => {
  try {
    const { items } = req.body;
    const inventory = await Inventory.findOneAndUpdate(
      { pharmacist: req.user._id },
      { items, lastUpdatedAt: new Date() },
      { new: true, upsert: true }
    );

    // ✅ Notify after save — inside the function, after inventory exists
    await triggerStockNotifications(req.user._id, inventory.items);

    res.json(inventory);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Inventory update failed" });
  }
};

/** CSV / JSON Upload */
export const uploadInventoryCSV = async (req, res) => {
  const normalizeKey    = (key = "") => key.toLowerCase().replace(/[^a-z0-9]/g, "");
  const resolveField    = (row, aliases) => { for (const k of aliases) { if (row[k] !== undefined && row[k] !== "") return row[k]; } return undefined; };
  const toNumberSafe    = (v) => { if (!v && v !== 0) return undefined; const n = Number(String(v).replace(/[^\d.]/g, "")); return isNaN(n) ? undefined : n; };
  const parseExpiryDate = (v) => {
    if (!v) return undefined;
    const c = v.trim();
    const a = c.match(/^(\d{1,2})[\/\-](\d{4})$/);              if (a) return new Date(+a[2], +a[1]-1, 1);
    const b = c.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/); if (b) return new Date(+b[3], +b[2]-1, +b[1]);
    const d = new Date(c); return isNaN(d.getTime()) ? undefined : d;
  };

  const normalizeRows = (rows) =>
    rows.map((row) => {
      const nr = {};
      Object.keys(row).forEach((k) => { nr[normalizeKey(k)] = typeof row[k] === "string" ? row[k].trim() : row[k]; });
      const medicineName = resolveField(nr, FIELD_ALIASES.medicineName);
      if (!medicineName) return null;
      return {
        medicineName,
        brand:    resolveField(nr, FIELD_ALIASES.brand),
        quantity: toNumberSafe(resolveField(nr, FIELD_ALIASES.quantity)) ?? 0,
        price:    toNumberSafe(resolveField(nr, FIELD_ALIASES.price)),
        expiry:   parseExpiryDate(resolveField(nr, FIELD_ALIASES.expiry)),
      };
    }).filter(Boolean);

  try {
    if (!req.file) return res.status(400).json({ message: "File required" });

    const fileContent   = req.file.buffer.toString("utf8").trim();
    let cleanedItems    = [];
    const looksLikeJSON = fileContent.startsWith("{") || fileContent.startsWith("[");

    if (looksLikeJSON) {
      try {
        const parsed = JSON.parse(fileContent);
        const rows   = Array.isArray(parsed) ? parsed : Object.values(parsed);
        cleanedItems = normalizeRows(rows);
      } catch {
        return res.status(400).json({ message: "Invalid JSON format in uploaded file" });
      }
    } else {
      const rows = await csv().fromString(fileContent);
      cleanedItems = normalizeRows(rows);
    }

    if (cleanedItems.length === 0) {
      return res.status(400).json({ message: "No valid medicines found. Check your file has a medicine name column." });
    }

    const inventory = await Inventory.findOneAndUpdate(
      { pharmacist: req.user._id },
      { items: cleanedItems, lastUpdatedAt: new Date() },
      { new: true, upsert: true }
    );

    // ✅ Notify after CSV upload too — inside the function, after inventory exists
    await triggerStockNotifications(req.user._id, inventory.items);

    res.json({ success: true, imported: cleanedItems.length, inventory });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ message: "Upload failed" });
  }
};