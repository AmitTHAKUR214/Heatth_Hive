import Pharmacy from "../models/Pharmacy.js";

export const getShop = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ owner: req.user._id });
    res.json({ pharmacy: pharmacy || null });
  } catch {
    res.status(500).json({ message: "Failed to fetch pharmacy" });
  }
};

export const createOrUpdateShop = async (req, res) => {
  try {
    const { name, address, email, phone, licenseNumber, gstNumber, lat, lng } = req.body;
    if (!name || !address || !lat || !lng) {
      return res.status(400).json({ message: "Name, address, and location are required" });
    }
    let pharmacy = await Pharmacy.findOne({ owner: req.user._id });
    if (!pharmacy) pharmacy = new Pharmacy({ owner: req.user._id });

    Object.assign(pharmacy, { name, address, email, phone, licenseNumber, gstNumber });
    pharmacy.location = { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] };
    pharmacy.verificationStatus = "pending";
    await pharmacy.save();
    res.json({ message: "Pharmacy profile saved", pharmacy });
  } catch {
    res.status(500).json({ message: "Failed to save pharmacy" });
  }
};

export const updateShop = async (req, res) => {
  try {
    const { name, address, email, phone, licenseNumber, gstNumber, lat, lng } = req.body;
    let pharmacy = await Pharmacy.findOne({ owner: req.user._id });
    if (!pharmacy) pharmacy = new Pharmacy({ owner: req.user._id });

    if (name)          pharmacy.name          = name;
    if (address)       pharmacy.address       = address;
    if (email)         pharmacy.email         = email;
    if (phone)         pharmacy.phone         = phone;
    if (licenseNumber) pharmacy.licenseNumber = licenseNumber;
    if (gstNumber)     pharmacy.gstNumber     = gstNumber;
    if (lat && lng)    pharmacy.location      = { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] };
    pharmacy.verificationStatus = "pending";

    await pharmacy.save();
    res.json({ message: "Pharmacy updated", pharmacy });
  } catch {
    res.status(500).json({ message: "Failed to update pharmacy" });
  }
};

export const uploadDocuments = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ owner: req.user._id });
    if (!pharmacy) return res.status(404).json({ message: "Pharmacy not found" });
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ message: "No documents uploaded" });
    }
    Object.entries(req.files).forEach(([field, fileArr]) => {
      pharmacy.documents[field] = { url: `/uploads/${fileArr[0].filename}`, uploadedAt: new Date(), status: "pending" };
    });
    pharmacy.verificationStatus = "pending";
    await pharmacy.save();
    res.json({ message: "Documents uploaded successfully", documents: pharmacy.documents });
  } catch (err) {
    console.error("updateShop error:", err.message);
    res.status(500).json({ message: err.message || "Failed to update pharmacy" });
  }
};