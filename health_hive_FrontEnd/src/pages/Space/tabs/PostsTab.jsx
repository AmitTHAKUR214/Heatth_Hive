import { useEffect, useState, lazy, Suspense } from "react";

const FeedCard = lazy(() => import("../../../components/FeedCard"));
const AskPost  = lazy(() => import("../../../QA/AskPost"));

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

export default function PostsTab({ spaceId, spaceName, isMember }) {
  const [items,     setItems]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [page,      setPage]      = useState(1);
  const [hasMore,   setHasMore]   = useState(false);
  const [filter,    setFilter]    = useState("all"); // all | post | question
  const [showWrite,    setShowWrite]    = useState(false);
  const [activeTopic,  setActiveTopic]  = useState(null);
  const [writeTab,  setWriteTab]  = useState("post");

  const fetchItems = async (pageNum = 1, replace = true) => {
    setLoading(true);
    try {
      const results = [];

      // Fetch posts and questions in parallel
      const [postsRes, questionsRes] = await Promise.all([
        filter !== "question"
          ? fetch(`${BASE_URL}/api/posts/space/${spaceId}?page=${pageNum}&limit=10`).then(r => r.json())
          : Promise.resolve({ items: [], hasMore: false }),
        filter !== "post"
          ? fetch(`${BASE_URL}/api/questions/space/${spaceId}?page=${pageNum}&limit=10`).then(r => r.json())
          : Promise.resolve({ items: [], hasMore: false }),
      ]);

      const combined = [
        ...(postsRes.items     || []),
        ...(questionsRes.items || []),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setItems(replace ? combined : prev => [...prev, ...combined]);
      setHasMore((postsRes.hasMore || questionsRes.hasMore) ?? false);
      setPage(pageNum);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(1, true); }, [spaceId, filter]);

  const handleWriteOpen = (tab) => { setWriteTab(tab); setShowWrite(true); };

  return (
    <div style={{ padding: "16px" }}>

      {/* ── Top bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>

        {/* Write buttons — only for members */}
        {isMember ? (
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => handleWriteOpen("post")}
              style={{ padding: "8px 16px", background: "var(--color-primary, #4f46e5)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
              ✍️ Write Post
            </button>
            <button onClick={() => handleWriteOpen("ask")}
              style={{ padding: "8px 16px", background: "none", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px", color: "var(--color)" }}>
              ❓ Ask Question
            </button>
          </div>
        ) : (
          <span style={{ fontSize: "13px", color: "#6b7280" }}>Join this space to post</span>
        )}

        {/* Filter pills */}
        <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
          {["all", "post", "question"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: "5px 12px", borderRadius: "20px", border: "1px solid var(--border-color, #e5e7eb)",
                background: filter === f ? "var(--color-primary, #4f46e5)" : "transparent",
                color: filter === f ? "white" : "var(--color)",
                cursor: "pointer", fontSize: "12px", fontWeight: 600,
              }}>
              {f === "all" ? "All" : f === "post" ? "Posts" : "Questions"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      {loading && items.length === 0 && (
        <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.5 }}>Loading…</div>
      )}

      {!loading && items.length === 0 && (
        <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.5 }}>
          <p style={{ fontSize: "32px", margin: "0 0 8px" }}>📭</p>
          <p style={{ fontSize: "14px" }}>No posts yet.{isMember ? " Be the first to post!" : ""}</p>
        </div>
      )}

      <Suspense fallback={null}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {items.map((item) => (
            <FeedCard key={item._id} item={item} onTopicClick={setActiveTopic} />
          ))}
        </div>
      </Suspense>

      {/* Load more */}
      {hasMore && !loading && (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button onClick={() => fetchItems(page + 1, false)}
            style={{ padding: "8px 24px", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: "8px", background: "none", cursor: "pointer", fontSize: "13px", color: "var(--color)" }}>
            Load more
          </button>
        </div>
      )}

      {loading && items.length > 0 && (
        <div style={{ textAlign: "center", padding: "16px", opacity: 0.5, fontSize: "13px" }}>Loading more…</div>
      )}

      {/* ── AskPost modal ── */}
      <Suspense fallback={null}>
        <AskPost
          isOpen={showWrite}
          activeTab={writeTab}
          onClose={() => { setShowWrite(false); fetchItems(1, true); }} // refresh on close
          spaceId={spaceId}
          spaceName={spaceName}
        />
      </Suspense>
    </div>
  );
}