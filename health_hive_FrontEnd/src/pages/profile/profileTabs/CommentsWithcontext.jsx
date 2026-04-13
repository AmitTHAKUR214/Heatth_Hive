import { useEffect, useState } from "react";
import FeedCard from "../../../components/FeedCard";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function CommentWithContext({ feedItem, comments = [], currentUserId }) {
  const token = localStorage.getItem("token");

  const [fullPost, setFullPost] = useState(feedItem || null);
  const [showCard, setShowCard] = useState(false); // delayed mount

  // Fetch full post if partial
  useEffect(() => {
    if (!feedItem) return;

    const isPartial = !feedItem.content || !feedItem._id || !feedItem.type;
    if (isPartial) {
      fetch(`${BASE_URL}/api/feed/${feedItem._id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((res) => res.json())
        .then((data) => setFullPost(data))
        .catch((err) => console.error("Failed to fetch post:", err));
    }
  }, [feedItem, token]);

  // Delay showing card slightly for smooth mount
  useEffect(() => {
    if (!fullPost) return;

    const timer = setTimeout(() => setShowCard(true), 300); // adjust delay
    return () => clearTimeout(timer);
  }, [fullPost]);

  // Only render FeedCard after delay
  return (
    <>
      {showCard ? (
        <FeedCard
          item={fullPost}
          extraComments={comments}
          currentUserId={currentUserId}
        />
      ) : (
        // placeholder keeps scroll height intact, so loader triggers
        // <div style={{ minHeight: "500px" }} />
        null
      )}
    </>
  );
}
