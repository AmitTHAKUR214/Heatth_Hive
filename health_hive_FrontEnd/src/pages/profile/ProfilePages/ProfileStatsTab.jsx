import { useEffect, useState } from "react";

const BASE = import.meta.env.VITE_API_BASE_URL || "";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getLastSixMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: MONTHS[d.getMonth()] };
  });
}

export default function ProfileStatsTab({ username, stats }) {
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    if (!username) return;
    fetch(`${BASE}/api/users/${username}/stats`)
      .then(r => r.json())
      .then(setActivity)
      .catch(() => {});
  }, [username]);

  const months = getLastSixMonths();

  const getCount = (arr, year, month) =>
    arr?.find(x => x._id.year === year && x._id.month === month)?.count || 0;

  const maxVal = Math.max(1, ...months.flatMap(m => [
    getCount(activity?.postsByMonth,     m.year, m.month),
    getCount(activity?.questionsByMonth, m.year, m.month),
  ]));

  return (
    <div style={{ padding: "16px 0" }}>

      {/* ── Summary cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px", marginBottom: "28px" }}>
        {[
          { label: "Posts",       value: activity?.postsCount     ?? stats?.posts,     icon: "📝", color: "#3b82f6" },
          { label: "Questions",   value: activity?.questionsCount ?? stats?.questions,  icon: "❓", color: "#8b5cf6" },
          { label: "Comments",    value: activity?.commentsCount  ?? stats?.comments,   icon: "💬", color: "#22c55e" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)",
            borderRadius: "12px", padding: "16px", textAlign: "center" }}>
            <div style={{ fontSize: "22px", marginBottom: "6px" }}>{icon}</div>
            <div style={{ fontSize: "24px", fontWeight: 700, color }}>{value ?? 0}</div>
            <div style={{ fontSize: "12px", color: "var(--color-muted)", marginTop: "2px" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Activity chart ── */}
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)",
        borderRadius: "12px", padding: "20px" }}>
        <h4 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: 600, color: "var(--color)" }}>
          Activity — Last 6 Months
        </h4>

        {/* Legend */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "16px", fontSize: "12px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#3b82f6", display: "inline-block" }} />
            Posts
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#8b5cf6", display: "inline-block" }} />
            Questions
          </span>
        </div>

        {/* Bars */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "120px" }}>
          {months.map(({ year, month, label }) => {
            const posts     = getCount(activity?.postsByMonth,     year, month);
            const questions = getCount(activity?.questionsByMonth, year, month);
            const postH     = Math.round((posts     / maxVal) * 100);
            const questionH = Math.round((questions / maxVal) * 100);
            return (
              <div key={`${year}-${month}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", height: "100%" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: "2px", width: "100%" }}>
                  <div title={`${posts} posts`} style={{ flex: 1, background: "#3b82f6", borderRadius: "3px 3px 0 0",
                    height: `${postH}%`, minHeight: posts > 0 ? "4px" : "0", transition: "height 0.4s ease" }} />
                  <div title={`${questions} questions`} style={{ flex: 1, background: "#8b5cf6", borderRadius: "3px 3px 0 0",
                    height: `${questionH}%`, minHeight: questions > 0 ? "4px" : "0", transition: "height 0.4s ease" }} />
                </div>
                <div style={{ fontSize: "11px", color: "var(--color-muted)", marginTop: "6px" }}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Content breakdown donut-style ── */}
      {activity && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)",
          borderRadius: "12px", padding: "20px", marginTop: "12px" }}>
          <h4 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 600, color: "var(--color)" }}>
            Content Breakdown
          </h4>
          {(() => {
            const total = (activity.postsCount || 0) + (activity.questionsCount || 0);
            if (total === 0) return <p style={{ color: "var(--color-muted)", fontSize: "13px" }}>No content yet.</p>;
            const postPct = Math.round((activity.postsCount / total) * 100);
            const qPct    = 100 - postPct;
            return (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <div style={{ flex: 1, height: "10px", borderRadius: "999px", overflow: "hidden",
                    background: "var(--border-color)" }}>
                    <div style={{ width: `${postPct}%`, height: "100%", background: "#3b82f6",
                      borderRadius: "999px", transition: "width 0.5s ease" }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "20px", fontSize: "12px" }}>
                  <span><strong style={{ color: "#3b82f6" }}>{postPct}%</strong> Posts ({activity.postsCount})</span>
                  <span><strong style={{ color: "#8b5cf6" }}>{qPct}%</strong> Questions ({activity.questionsCount})</span>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}