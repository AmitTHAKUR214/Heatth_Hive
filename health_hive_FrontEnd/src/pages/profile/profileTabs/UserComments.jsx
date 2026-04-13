import { useRef, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import CommentWithContext from "./CommentsWithcontext";
import Spinner from "../../../components/Spinner";

export default function UserComments({ username, currentUserId }) {
  const loaderRef = useRef(null);

  const fetchUserComments = async ({ pageParam = 1 }) => {
    const BASE_URL = import.meta.env.VITE_API_BASE_URL;
    const res = await fetch(
      `${BASE_URL}/api/comments/user/${username}?page=${pageParam}&limit=7`
    );
    if (!res.ok) throw new Error("Failed to fetch comments");
    return res.json();  
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["userComments", username],
    queryFn: fetchUserComments,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    enabled: !!username,
  });

  const allComments = data?.pages.flatMap(p => p.items) ?? [];

  // Group comments by post/question
  const groupedComments = allComments.reduce((acc, comment) => {
    const key = comment.contentId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(comment);
    return acc;
  }, {});

  // Intersection observer for lazy loading
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
        <Spinner /><br />Loading Comments ....
      </div>
    );
  }
  if (!allComments.length) return <p style={{ opacity: 0.6 }}>No comments yet.</p>;

  return (
    <>
      {Object.values(groupedComments).map((commentsInFeed) => {
        const firstComment = commentsInFeed[0];

          let mainItem = firstComment.post || firstComment.question;

          if (mainItem && !mainItem.type) {
            mainItem = {
              ...mainItem,
              type: firstComment.post ? "post" : "question",
            };
          }

        return (
         <CommentWithContext
            key={mainItem?._id || commentsInFeed[0]._id}
            feedItem={mainItem}
            comments={commentsInFeed}
            currentUserId={currentUserId}
          />
        );
      })}

      {/* Loader is always in the DOM for IntersectionObserver */}
      <div ref={loaderRef} style={{ textAlign: "center", padding: "12px" }}>
        {isFetching ? "Loading more..." : hasNextPage ? "Scroll to load more" : null}
      </div>
    </>
  );
}