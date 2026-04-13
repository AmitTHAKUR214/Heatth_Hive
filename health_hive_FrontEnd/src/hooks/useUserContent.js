// hooks/useUserContent.js
import { useEffect, useState } from "react";

export function useUserContent(fetchFn, username) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    reset();
  }, [username]);

  const reset = () => {
    setItems([]);
    setPage(1);
    setHasMore(true);
  };

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    const { data } = await fetchFn({ username, page });

    setItems((prev) => [...prev, ...data.items]);
    setHasMore(data.hasMore);
    setPage((p) => p + 1);
    setLoading(false);
  };

  return { items, loadMore, loading, hasMore };
}