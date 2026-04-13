import client from "./client.js";

export const getDoctorProfile = () => client.get("/doctor/profile");
export const getPublicDoctorProfile = (username) => client.get(`/doctor/public/${username}`);
export const saveDoctorProfile = (data) => client.post("/doctor/profile", data);
export const uploadDoctorDocs = (formData) =>
  client.post("/doctor/profile/documents", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });