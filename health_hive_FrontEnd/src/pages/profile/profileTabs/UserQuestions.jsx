import { useRef, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import FeedCard from "../../../components/FeedCard";
import "../../../QA/QuestionsList.css"
import Spinner from "../../../components/Spinner";
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 🔹 fetcher
const fetchUserQuestions = async ({ pageParam = 1, queryKey }) => {
  const [, username] = queryKey;

  const res = await fetch(
    (`${BASE_URL}/api/questions/user/username/${username}?page=${pageParam}`)
  );

  if (!res.ok) throw new Error("Failed to fetch questions");
  return res.json();
};

export default function UserQuestions({ username }) {
  const loaderRef = useRef(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["userQuestions", username], // 🔥 cache key
    queryFn: fetchUserQuestions,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60 * 1000, // 🔥 instant tab switching
    enabled: !!username,
  });

  // flatten pages
  const items = data?.pages.flatMap(p => p.items) ?? [];

  // IntersectionObserver (same idea, cleaner effect)
  useEffect(() => {
    if (!loaderRef.current || !hasNextPage || isFetching) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        fetchNextPage();
      }
    });

    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching, fetchNextPage]);

  // loading spinner
   if (isLoading) {
    return (
      <div className="center_container">
        <Spinner /><br />Loading Questions ....
      </div>
    );
  }

  if (!items.length) {
    return <p style={{ opacity: 0.6 }}>No questions yet.</p>;
  }

  return (
    <>
      {items.map(item => (
        <FeedCard key={item._id} item={item} />
      ))}

      {hasNextPage && (
        <div ref={loaderRef}>
          {isFetching && <Spinner size={22} />}
        </div>
      )}
    </>
  );
}