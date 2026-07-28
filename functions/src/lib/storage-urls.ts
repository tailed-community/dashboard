import { storage } from "./firebase";

/**
 * Firebase Storage media URLs.
 *
 * Two flavours, both hitting the same `/v0/b/{bucket}/o/{path}?alt=media`
 * endpoint:
 *
 *  - WITH a download token: anyone holding the URL can read the object
 *    regardless of storage.rules. This is how marketing assets are served —
 *    see routes/community-marketing.ts.
 *  - WITHOUT a token: the request is evaluated against storage.rules as an
 *    unauthenticated read. Used for community logos, which storage.rules
 *    already exposes with `allow read: if true`.
 *
 * Against the storage emulator the same paths are served from the emulator
 * host, so links built in a local run actually resolve.
 */
export const storageMediaUrl = (
  storagePath: string,
  token?: string | null
): string => {
  const bucketName = storage.bucket().name;
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const origin = emulatorHost
    ? `http://${emulatorHost}`
    : "https://firebasestorage.googleapis.com";

  const url = `${origin}/v0/b/${bucketName}/o/${encodeURIComponent(
    storagePath
  )}?alt=media`;

  return token ? `${url}&token=${token}` : url;
};
