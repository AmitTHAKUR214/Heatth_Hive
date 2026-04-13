import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import FeedCard from "../components/FeedCard";
import { feedCache } from "../cache/feedCache";
import "./QuestionsList.css";

function Skeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-desc" />
      <section style={{ display: "flex", gap: "4px" }}>
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton-line skeleton-desc short" />)}
      </section>
      <div className="skeleton-actions">
        {[...Array(4)].map((_, i) => <span key={i} className="skeleton-circle" />)}
      </div>
    </div>
  );
}

const BATCH_SIZE = 10;

export default function QuestionsList({ mode = "feed", activeTopic = null, onTopicClick, sortBy = "recent" }) {
  const BASE_API =
    mode === "questions" || mode === "question"
      ? `${import.meta.env.VITE_API_BASE_URL}/api/questions`
    : mode === "posts"
      ? `${import.meta.env.VITE_API_BASE_URL}/api/posts`
    :   `${import.meta.env.VITE_API_BASE_URL}/api/feed`;

    const userRole = (() => {
      try { return JSON.parse(localStorage.getItem("user"))?.role || "guest"; }
      catch { return "guest"; }
    })();
  // include sortBy in cache key so trending and recent are cached separately
  const API_URL = `${BASE_API}?sortBy=${sortBy}&role=${userRole}${activeTopic ? `&topic=${activeTopic}` : ""}`;
  const scrollKey = `scroll-${API_URL}`;

  const cached = feedCache.get(API_URL);
  const [items,   setItems]   = useState(cached?.items   || []);
  const [cursor,  setCursor]  = useState(cached?.cursor  || null);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? true);
  const [loading, setLoading] = useState(false);

  const containerRef  = useRef(null);
  const loaderRef     = useRef(null);
  const restoredRef   = useRef(false);
  const fetchingRef   = useRef(false);
  const mountedRef    = useRef(false);

  /* ── core fetch ── */
  const fetchMore = useCallback(async (currentCursor) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);

    try {
      const params = new URLSearchParams({ limit: BATCH_SIZE });
      if (currentCursor) params.set("cursor", currentCursor);
      if (activeTopic)   params.set("topic",  activeTopic);
      if (sortBy)        params.set("sortBy", sortBy);
      params.set("role", userRole);

      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE_API}?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error("Fetch failed");

      const data     = await res.json();
      const newItems = Array.isArray(data) ? data : (data.items || []);

      setItems(prev => {
        const updated = currentCursor ? [...prev, ...newItems] : newItems;
        feedCache.set(API_URL, {
          items:   updated,
          cursor:  data.nextCursor || null,
          hasMore: Boolean(data.nextCursor),
        });
        return updated;
      });

      setCursor(data.nextCursor || null);
      setHasMore(Boolean(data.nextCursor));
    } catch (err) {
      console.error("Feed fetch error:", err);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [BASE_API, API_URL, activeTopic, sortBy]);

  /* ── init: fetch only if no cache ── */
  useEffect(() => {
    mountedRef.current = true;
    if (!feedCache.get(API_URL)) {
      fetchMore(null);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── reset when topic, mode or sortBy changes (skip first mount) ── */
  useEffect(() => {
    if (!mountedRef.current) return;
    restoredRef.current = false;
    feedCache.delete(API_URL);
    setItems([]);
    setCursor(null);
    setHasMore(true);
    fetchMore(null);
  }, [activeTopic, BASE_API, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── infinite scroll ── */
  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader || !hasMore) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fetchingRef.current) {
        setCursor(prev => { fetchMore(prev); return prev; });
      }
    }, { rootMargin: "300px" });

    observer.observe(loader);
    return () => observer.disconnect();
  }, [hasMore, fetchMore]);

  /* ── save scroll position ── */
  useEffect(() => {
    const save = () => sessionStorage.setItem(scrollKey, window.scrollY);
    window.addEventListener("scroll", save);
    return () => { save(); window.removeEventListener("scroll", save); };
  }, [scrollKey]);

  /* ── restore scroll once items load ── */
  useEffect(() => {
    if (restoredRef.current || !items.length) return;
    const y = sessionStorage.getItem(scrollKey);
    if (!y || Number(y) === 0) return;
    restoredRef.current = true;
    const target = Number(y);
    let attempts = 0;
    const tryRestore = () => {
      if (document.documentElement.scrollHeight >= target + window.innerHeight || attempts > 10) {
        window.scrollTo({ top: target, behavior: "instant" });
      } else {
        attempts++;
        setTimeout(tryRestore, 50);
      }
    };
    requestAnimationFrame(tryRestore);
  }, [items.length, scrollKey]);

  /* ── deduplicate ── */
  const uniqueItems = useMemo(() => {
    const seen = new Set();
    // for question/questions mode, items come back typed as "questions" from backend
    const list = (mode === "feed")
      ? items
      : items.filter(i =>
          i.type === mode ||
          i.type === "questions" && (mode === "question" || mode === "questions") ||
          i.type === "posts"     && mode === "posts"
        );
    return list.filter(item => {
      const key = `${item.type}-${item._id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [items, mode]);

  return (
    <div ref={containerRef} className="qa-container">

      {activeTopic && (
        <div style={{
          padding: "8px 14px", marginBottom: "8px", borderRadius: "8px",
          background: "var(--color-g, #22c55e)18",
          border: "1px solid var(--color-g, #22c55e)33",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-g, #22c55e)" }}>
            #{activeTopic}
          </span>
          <button onClick={() => onTopicClick?.(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "var(--color-3)", padding: "0 4px" }}>
            ✕ clear
          </button>
        </div>
      )}

      {uniqueItems.map(item => (
        <FeedCard
          key={`${item.type}-${item._id}`}
          item={item}
          onTopicClick={onTopicClick}
        />
      ))}

      {loading && [...Array(3)].map((_, i) => <Skeleton key={i} />)}

      {hasMore && <div ref={loaderRef} className="feed-loader" />}

      {!loading && !uniqueItems.length && (
        <p style={{ opacity: 0.6 }}>
          {activeTopic ? `No posts found for #${activeTopic}` : "No content found."}
        </p>
      )}
    </div>
  );
}