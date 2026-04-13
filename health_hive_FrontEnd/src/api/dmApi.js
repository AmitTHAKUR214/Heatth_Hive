import client from "./client.js";

export const sendDMRequest      = (receiverId, message) => client.post("/dm/request", { receiverId, message });
export const respondDMRequest   = (id, status)          => client.patch(`/dm/request/${id}/respond`, { status });
export const cancelDMRequest    = (id)                  => client.delete(`/dm/request/${id}/cancel`);
export const cancelAllDMRequests = ()                   => client.delete("/dm/request/cancel-all");
export const getSentDMRequests  = ()                    => client.get("/dm/request/sent");
export const getPendingDMs      = ()                    => client.get("/dm/pending");
export const getActiveDMRoom    = ()                    => client.get("/dm/active");
export const getRoomMessages    = (roomId)              => client.get(`/dm/room/${roomId}/messages`);
export const sendDMMessage      = (roomId, text)        => client.post(`/dm/room/${roomId}/messages`, { text });
export const closeDMRoom        = (roomId)              => client.post(`/dm/room/${roomId}/close`);
export const exportDMRoom       = (roomId)              => client.get(`/dm/room/${roomId}/export`);