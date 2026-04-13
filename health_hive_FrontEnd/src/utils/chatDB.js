const DB_NAME    = "HealthHiveChat";
const DB_VERSION = 1;
const STORE      = "messages";

const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(STORE)) {
      const store = db.createObjectStore(STORE, { keyPath: "_id" });
      store.createIndex("conversationId", "conversationId", { unique: false });
    }
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror   = () => reject(req.error);
});

export const saveMessages = async (messages) => {
  if (!messages?.length) return;
  const db    = await openDB();
  const tx    = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  messages.forEach(m => store.put(m));
  return new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror    = rej;
  });
};

export const getMessages = async (conversationId) => {
  const db    = await openDB();
  const tx    = db.transaction(STORE, "readonly");
  const index = tx.objectStore(STORE).index("conversationId");
  const req   = index.getAll(conversationId);
  return new Promise((res, rej) => {
    req.onsuccess = () => res(
      req.result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    );
    req.onerror = rej;
  });
};