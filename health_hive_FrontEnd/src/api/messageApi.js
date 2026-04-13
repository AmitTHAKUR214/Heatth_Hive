import client from "./client.js";

export const getInbox              = ()                        => client.get("/messages");
export const startConversation     = (userId)                  => client.post(`/messages/conversation/${userId}`);
export const getMessages           = (conversationId, before)  => client.get(`/messages/${conversationId}`, { params: { before, limit: 50 } });
export const sendMessage = (conversationId, data) => {
  if (data instanceof FormData) {
    return client.post(`/messages/${conversationId}`, data);
  }
  // plain text fallback
  const fd = new FormData();
  fd.append("text", data);
  return client.post(`/messages/${conversationId}`, fd);
};

export const deleteMessage         = (conversationId, msgId, forEveryone = false) => client.delete(`/messages/${conversationId}/message/${msgId}`, { params: { forEveryone } });
export const deleteConversation    = (conversationId)          => client.delete(`/messages/${conversationId}`);
export const toggleMute            = (conversationId)          => client.post(`/messages/${conversationId}/mute`);
export const blockUser             = (userId)                  => client.post(`/messages/block/${userId}`);
export const unblockUser           = (userId)                  => client.delete(`/messages/block/${userId}`);
export const getBlockedList        = ()                        => client.get("/messages/block/list");