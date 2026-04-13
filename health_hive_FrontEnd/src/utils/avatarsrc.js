const BASE = import.meta.env.VITE_API_BASE_URL || "";

/**
 * Returns a fully-qualified avatar URL.
 * Handles relative paths (/avatar.png), full URLs (https://...), and null/empty.
 */
export const avatarSrc = (avatar) => {
  if (!avatar || avatar.includes("null") || avatar.includes("undefined")) return null;
  if (avatar.startsWith("http")) return avatar;
  return `${BASE}${avatar}`;
};