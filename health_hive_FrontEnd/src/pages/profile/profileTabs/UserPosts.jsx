import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import FeedCard from "../../../components/FeedCard";
import "../../../QA/QuestionsList.css"
import Spinner from "../../../components/Spinner";



const fetchUserPosts = async ({ pageParam = 1, queryKey }) => {
  const [, username] = queryKey;

  const BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const res = await fetch(
    (`${BASE_URL}/api/posts/user/username/${username}?page=${pageParam}`)
  );

  if (!res.ok) throw new Error("Failed to fetch posts");
  return res.json();
};

export default function UserPosts({ username }) {
  const loaderRef = useRef(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["userPosts", username],
    queryFn: fetchUserPosts,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
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
        <Spinner /><br />Loading Posts ....
      </div>
    );
  }

  if (!items.length) {
    return <p style={{ opacity: 0.6 }}>No posts yet.</p>;
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