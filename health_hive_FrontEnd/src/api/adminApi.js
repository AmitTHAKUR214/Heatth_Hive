import client from "./client.js";

export const fetchPharmacists = (status) =>
  client.get("/admin/pharmacists", { params: status ? { status } : {} });

export const approvePharmacistShop = (id) =>
  client.patch(`/admin/pharmacists/${id}/approve`);

export const rejectPharmacistShop = (id) =>
  client.patch(`/admin/pharmacists/${id}/reject`);

export default client;