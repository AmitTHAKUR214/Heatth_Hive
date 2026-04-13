import React from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import "./css/MiniFeedCard.css"
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

function MiniCard({ item, index }) {
  const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;

  return (
    <div className="qa-card" style={{ position: "relative" }}>

      {medal && (
        <span style={{
          position: "absolute", top: "-10px", right: "-8px",
          fontSize: "22px", lineHeight: 1,
        }}>
          {medal}
        </span>
      )}

      <Link to={`/post/${item._id}`} style={{ textDecoration: "none", color: "inherit" }}>
        <p style={{ fontWeight: 600, fontSize: "15px", marginBottom: "4px" }}>
          {item.title || "Untitled"}
        </p>
        <p style={{ fontSize: "13px", color: "var(--color-3)", marginBottom: "8px" }}>
          {item.description || item.content || ""}
        </p>
      </Link>

      <div className="qa-actions" style={{ pointerEvents: "none" }}>
        <div className="action-item">
          <i className="fa-solid fa-thumbs-up" style={{ color: "var(--color-3)" }} />
          <span>{item.stats?.likes || 0}</span>
        </div>
        <div className="action-item">
          <i className="fa-solid fa-thumbs-down" style={{ color: "var(--color-3)" }} />
          <span>{item.stats?.dislikes || 0}</span>
        </div>
        <div className="action-item">
          <i className="fa-solid fa-comment" style={{ color: "var(--color-3)" }} />
          <span>{item.stats?.comments || 0}</span>
        </div>
        <div className="action-item">
          <i className="fa-solid fa-share-nodes" style={{ color: "var(--color-3)" }} />
          <span>{item.stats?.shares || 0}</span>
        </div>
        <div className="action-item">
          <i className="fa-solid fa-flag" style={{ color: "var(--color-3)" }} />
          <span>{item.stats?.flags || 0}</span>
        </div>
      </div>
    </div>
  );
}

export default MiniCard;