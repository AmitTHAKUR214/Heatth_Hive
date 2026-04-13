import client from "./client.js";

export const createPost = (formData) => client.post("/posts", formData);
export const createQuestion = (formData) => client.post("/questions", formData);