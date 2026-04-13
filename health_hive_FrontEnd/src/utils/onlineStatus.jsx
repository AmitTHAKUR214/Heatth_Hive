import { useState, useEffect } from "react";
import { presenceStore, getSocket } from "./socket.js"; // adjust path

export function OnlineDot({ userId, lastSeen, isOnline: onlineProp, size = 10, style = {} }) {
  const [online, setOnline] = useState(() => {
    // initial value — use store if available, else prop, else lastSeen fallback
    if (userId && presenceStore.get(userId) !== undefined)
      return presenceStore.get(userId);
    if (typeof onlineProp === "boolean") return onlineProp;
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 90_000;
  });

  useEffect(() => {
    if (!userId) return;
    // make sure socket is alive
    getSocket();
    // subscribe to future updates for this user
    return presenceStore.subscribe((changedId, isOnline) => {
      if (changedId === userId) setOnline(isOnline);
    });
  }, [userId]);

  return (
    <span title={online ? "Online" : "Offline"} style={{
      display: "inline-block", width: size, height: size,
      borderRadius: "50%", background: online ? "#22c55e" : "#d1d5db",
      flexShrink: 0, ...style,
    }} />
  );
}