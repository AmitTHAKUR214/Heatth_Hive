import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

// derive a 32-byte key from conversationId + server secret
const deriveKey = (conversationId) => {
  return crypto.scryptSync(
    `${conversationId}${process.env.JWT_SECRET}`,
    "healthhive-salt",
    32
  );
};

export const encryptMessage = (text, conversationId) => {
  const key = deriveKey(conversationId);
  const iv  = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  // store iv:authTag:ciphertext
  return {
    encrypted: `${iv.toString("hex")}:${authTag}:${encrypted}`,
  };
};

export const decryptMessage = (encryptedText, conversationId) => {
  try {
    const [ivHex, authTagHex, ciphertext] = encryptedText.split(":");
    const key     = deriveKey(conversationId);
    const iv      = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return "[message could not be decrypted]";
  }
};