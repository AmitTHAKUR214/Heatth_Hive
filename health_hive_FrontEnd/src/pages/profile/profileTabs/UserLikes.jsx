// components/profile/UserLiked.jsx
import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import FeedCard from "../../../components/FeedCard";
import Spinner from "../../../components/Spinner";
import "../../../QA/QuestionsList.css";
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const UserLikes = async ({ pageParam = 1, queryKey }) => {
  const [, username] = queryKey;
  const token = localStorage.getItem("token");

  const res = await fetch(
    `${BASE_URL}/api/content/liked/${username}?page=${pageParam}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );

  if (!res.ok) throw new Error("Failed to fetch liked content");
  return res.json();
};

export default function UserLiked({ username }) {
  const loaderRef = useRef(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["userLiked", username],
    queryFn: UserLikes,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    enabled: !!username,
  });

  const items = data?.pages.flatMap(p => p.items) ?? [];

  useEffect(() => {
    if (!loaderRef.current || !hasNextPage || isFetching) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) fetchNextPage();
    });

    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="center_container">
        <Spinner /><br />Loading Liked Content ....
      </div>
    );
  }

  if (!items.length) {
    return <p style={{ opacity: 0.6 }}>No liked posts or questions yet.</p>;
  }

  return (
    <>
      {items.map(L => (
        <FeedCard key={L._id} item={L} />
      ))}

      {hasNextPage && (
        <div ref={loaderRef}>
           {isFetching && <Spinner size={22} />}
        </div>
      )}
    </>
  );
}