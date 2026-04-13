import { useState } from "react";

export default function CommentItem({
  comment,
  currentUserId,
  onReply,
  onEdit,
  onDelete
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");

  const commentId = comment._id || comment.id;
  const author = comment.author || comment.userId;
  const authorId = author?._id || author?.id;

  const isOwner =
    currentUserId &&
    authorId &&
    String(authorId) === String(currentUserId);

  const submitReply = () => {
    if (!replyText.trim()) return;
    onReply(commentId, replyText);
    setReplyText("");
    setShowReply(false);
  };

  return (
    <div className="comment-item">
      {/* Header */}
      <div className="comment-header">
        <strong>{author?.name || "User"}</strong>

        {isOwner && (
          <span className="comment-actions">
            <button onClick={() => onEdit(comment)}>Edit</button>
            <button onClick={() => onDelete(commentId)}>Delete</button>
          </span>
        )}
      </div>

      {/* Text */}
      <p>{comment.text}</p>

      {/* Reply button */}
      <button onClick={() => setShowReply(!showReply)}>
        Reply
      </button>

      {/* Reply box */}
      {showReply && (
        <div className="reply-box">
          <input
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Write a reply..."
          />
          <button onClick={submitReply}>Post</button>
        </div>
      )}

      {/* Recursive replies */}
      {comment.replies?.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map(reply => (
            <CommentItem
              key={reply._id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
