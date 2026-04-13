export function useCommentComposer({ item, token }) {
  const BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const submit = async () => {
    if (!token || !text.trim()) return;

    setPosting(true);
    await fetch(`${BASE_URL}/api/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        contentType: item.type,
        contentId: item._id,
        text,
      }),
    });

    setText("");
    setRefreshKey(prev => prev + 1);
    setPosting(false);
  };

  return { text, setText, posting, submit, refreshKey };
}
