import client from "./client.js";

export const getUserProfile = (userId) =>
  client.get(`/users/${userId}/profile`).then(r => r.data);

export const getUserProfileByUsername = (username) => {
  if (!username) throw new Error("Username is required");
  return client.get(`/users/profile/${username.toLowerCase()}`).then(r => r.data);
};

export const getUserPosts = (userId) =>
  client.get(`/posts/user/${userId}`).then(r => r.data);