import { io } from "socket.io-client";

const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

let socket = null;

// ── Presence store ──────────────────────────────────────────────
const listeners = new Set();
export const presenceStore = {
  _map: new Map(),
  set(userId, online) {
    this._map.set(String(userId), online);
    listeners.forEach(fn => fn(String(userId), online));
  },
  get(userId) {
    return this._map.get(String(userId));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// ── Socket ──────────────────────────────────────────────────────
export const getSocket = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  if (socket?.connected) return socket;
  if (socket) { socket.disconnect(); socket = null; }

  socket = io(BASE, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
    transports: ["polling"],
  });

  socket.on("connect", () => {
    // console.log("Socket connected:", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.error("Socket error:", err.message);
  });

  socket.on("disconnect", (reason) => {
    console.warn("Socket disconnected:", reason);
  });

  // ── Presence events ──
  socket.on("user:online",  ({ userId }) => presenceStore.set(userId, true));
  socket.on("user:offline", ({ userId }) => presenceStore.set(userId, false));

  return socket;
};

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};