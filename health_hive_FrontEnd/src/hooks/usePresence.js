import { useEffect, useRef } from "react";
import { getSocket } from "../utils/socket";

const BASE = import.meta.env.VITE_API_BASE_URL;
const INTERVAL_MS = 60_000; // ping every 60s

const ping = (endpoint) => {
  const token = localStorage.getItem("token");
  if (!token) return;
  const url = `${BASE}/api/users/${endpoint}`;
  fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => {});
};

export function usePresence() {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    // init socket connection
    getSocket();

    // go online immediately
    ping("heartbeat");

    // keep pinging while tab is open
    intervalRef.current = setInterval(() => {
      // pause if tab is hidden — resume when visible
      if (!document.hidden) ping("heartbeat");
    }, INTERVAL_MS);

    // go offline when tab becomes visible again after long absence
    const handleVisibility = () => {
      if (!document.hidden) ping("heartbeat");
    };

    // go offline on page close
    const handleUnload = () => ping("offline");

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleUnload);
      if (localStorage.getItem("token")) ping("offline");
    };
  }, []);
}