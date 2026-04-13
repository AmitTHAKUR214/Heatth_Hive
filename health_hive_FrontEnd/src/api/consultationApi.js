import client from "./client.js";

export const sendConsultationRequest = (doctorId, message) =>
  client.post("/consultations", { doctorId, message });

export const getMyRequests = () =>
  client.get("/consultations/my-requests");

export const getIncomingRequests = (status) =>
  client.get("/consultations/incoming", { params: status ? { status } : {} });

export const respondToRequest = (id, status, doctorNote = "") =>
  client.patch(`/consultations/${id}/respond`, { status, doctorNote });

export const closeRequest = (id) =>
  client.patch(`/consultations/${id}/close`);

export const getMessages = (id) =>
  client.get(`/consultations/${id}/messages`);

export const sendMessage = (id, text) =>
  client.post(`/consultations/${id}/messages`, { text });
