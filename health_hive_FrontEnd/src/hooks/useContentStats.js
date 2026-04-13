import { useEffect, useState } from "react";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function useContentStats({ contentId, contentType, token }) {
  const [stats, setStats] = useState({
    likes: 0,
    dislikes: 0,
    comments: 0,
    shares: 0,
    flags: 0,
  });

  const [loading, setLoading] = useState({});

  const updateStats = async (signal) => {
    if (!token || !contentId || !contentType) return;

    const res = await fetch(
      `${BASE_URL}/api/content/stats/${contentType}/${contentId}`,
      {
        signal,
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) return;
    const data = await res.json();

    setStats({
      likes: data.likes ?? 0,
      dislikes: data.dislikes ?? 0,
      comments: data.comments ?? 0,
      shares: data.shares ?? 0,
      flags: data.flags ?? 0,
    });
  };

  const interact = async (action) => {
    setLoading(prev => ({ ...prev, [action]: true }));

    await fetch(`${BASE_URL}/api/content/interact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ contentId, contentType, action }),
    });

    await updateStats();
    setLoading(prev => ({ ...prev, [action]: false }));
  };

  useEffect(() => {
    if (!contentId || !token) return;
    const controller = new AbortController();
    updateStats(controller.signal);
    return () => controller.abort();
  }, [contentId, token]);

  return { stats, loading, interact };
}
