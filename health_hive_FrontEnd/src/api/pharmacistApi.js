import client from "./client.js";

export const getPharmacyProfile = () => client.get("/pharmacist/shop");
export const updatePharmacyProfile = (data) => client.patch("/pharmacist/shop", data);
export const uploadVerificationDocs = (formData) => client.post("/pharmacist/shop/documents", formData);
export const fetchInventorySummary = () => client.get("/inventory/summary");
export const updateDocumentStatus = (pharmacyId, documentType, status) =>
  client.patch(`/admin/pharmacist/${pharmacyId}/document`, { documentType, status });