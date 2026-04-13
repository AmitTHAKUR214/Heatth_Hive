import React, { useState, useEffect, useRef, useCallback } from "react";
import Minifeedcard from "../components/MiniFeedCard"
import { feedCache } from "../cache/feedCache";

const BATCH_SIZE = 10;

export default function MiniQuestionsList({ mode = "feed", activeTopic = null, sortBy = "recent" }) {
  const BASE_API = `${import.meta.env.VITE_API_BASE_URL}/api/${
    mode === "questions" || mode === "question" ? "questions" : mode === "posts" ? "posts" : "feed"
  }`;
  const API_URL = `${BASE_API}?sortBy=${sortBy}${activeTopic ? `&topic=${activeTopic}` : ""}`;

  const cached = feedCache.get(API_URL);
  const [items,   setItems]   = useState(cached?.items  || []);
  const [cursor,  setCursor]  = useState(cached?.cursor || null);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? true);
  const [loading, setLoading] = useState(false);

  const loaderRef    = useRef(null);
  const fetchingRef  = useRef(false);

  const fetchMore = useCallback(async (currentCursor) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: BATCH_SIZE, sortBy });
      if (currentCursor) params.set("cursor", currentCursor);
      if (activeTopic)   params.set("topic", activeTopic);

      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE_API}?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Fetch failed");

      const data     = await res.json();
      const newItems = Array.isArray(data) ? data : (data.items || []);

      setItems(prev => {
        const updated = currentCursor ? [...prev, ...newItems] : newItems;
        feedCache.set(API_URL, { items: updated, cursor: data.nextCursor || null, hasMore: Boolean(data.nextCursor) });
        return updated;
      });
      setCursor(data.nextCursor || null);
      setHasMore(Boolean(data.nextCursor));
    } catch (err) {
      console.error("Mini feed error:", err);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [BASE_API, API_URL, activeTopic, sortBy]);

  useEffect(() => {
    if (!feedCache.get(API_URL)) fetchMore(null);
  }, []); // eslint-disable-line

  // infinite scroll
  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fetchingRef.current)
        setCursor(prev => { fetchMore(prev); return prev; });
    }, { rootMargin: "300px" });
    observer.observe(loader);
    return () => observer.disconnect();
  }, [hasMore, fetchMore]);

  return (
    <div className="qa-container">
      {items.map((item, index) => (
            <Minifeedcard key={`${item.type}-${item._id}`} item={item} index={index} />
        ))}
      {loading && <p style={{ opacity: 0.5, fontSize: "13px" }}>Loading...</p>}
      {hasMore && <div ref={loaderRef} />}
      {!loading && !items.length && <p style={{ opacity: 0.6 }}>No content found.</p>}
    </div>
  );
}