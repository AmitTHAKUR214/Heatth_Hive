import client from "./client.js";

export const getNearbyPharmacies = (lat, lng, radius = 2500) =>
  client.get("/pharmacies/nearby", { params: { lat, lng, radius } });

export const subscribeToPharmacy = (id) =>
  client.post(`/pharmacies/${id}/subscribe`);

export const unsubscribeFromPharmacy = (id) =>
  client.delete(`/pharmacies/${id}/subscribe`);

export const getSubscriptionStatus = (id) =>
  client.get(`/pharmacies/${id}/subscription-status`);

export const getPharmacyInventory = (id) =>
  client.get(`/pharmacies/${id}/inventory`);

export const bookMedicine = (pharmacyId, medicineId, quantity, note = "") =>
  client.post(`/pharmacies/${pharmacyId}/bookings`, { medicineId, quantity, note });

export const getMyBookings = () =>
  client.get("/pharmacies/bookings/mine");

export const cancelBooking = (bookingId) =>
  client.patch(`/pharmacies/bookings/${bookingId}/cancel`);

export const getPharmacyBookings = (pharmacyId, status) =>
  client.get(`/pharmacies/${pharmacyId}/bookings`, { params: status ? { status } : {} });

export const updateBookingStatus = (pharmacyId, bookingId, status) =>
  client.patch(`/pharmacies/${pharmacyId}/bookings/${bookingId}/status`, { status });