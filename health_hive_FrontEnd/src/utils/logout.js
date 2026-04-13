import { disconnectSocket } from "./socket.js";

const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const logout = () => {
  try {
    const token = localStorage.getItem("token");
    if (token) {
      fetch(`${BASE}/api/users/offline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {});
    }
    disconnectSocket();
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/login";
  } catch (err) {
    console.error("Logout failed:", err);
  }
};