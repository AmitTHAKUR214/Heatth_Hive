import client from "./client.js";

export const registerUser = (data) =>
  client.post("/auth/register", {
    name: data.name, username: data.username,
    email: data.email, password: data.password, role: data.role,
  });

export const loginUser = (data) =>
  client.post("/auth/login", { email: data.email, password: data.password });

export const verifyEmail = (token) =>
  client.get(`/auth/verify-email?token=${token}`);

export const getPUser = () => {
  try {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  } catch { return null; }
};

export const getToken = () => localStorage.getItem("token");