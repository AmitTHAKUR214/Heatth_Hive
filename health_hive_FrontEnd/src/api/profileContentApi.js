import client from "./client.js";

export const getUserPosts = ({ username, page }) =>
  client.get(`/posts/user/username/${username}?page=${page}`);