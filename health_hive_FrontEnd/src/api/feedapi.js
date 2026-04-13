import client from "./client.js";

export const fetchFeed = (params) => client.get("/feed", { params });