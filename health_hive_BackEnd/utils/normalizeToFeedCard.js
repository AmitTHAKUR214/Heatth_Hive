// utils/normalizeToFeedCard.js
export const normalizePostToFeedCard = (post) => ({
  id: post._id,
  type: "post",
  author: post.author,
  content: post.content,
  media: post.media || [],
  stats: {
    likes: post.likesCount,
    comments: post.commentsCount,
  },
  createdAt: post.createdAt,
});