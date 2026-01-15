import { getApps, getApp, initializeApp } from "@firebase/app";
import { getDownloadURL, getStorage, ref } from "firebase/storage";

export function FirebaseClient() {
  if (!getApps().length) {
    initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, // Make sure this env var is set
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });
  }

  return null;
}

// Get Firebase Storage instance
export const getFirebaseStorage = () => {
  const app = getApp();
  return import.meta.env.DEV
    ? getStorage(app, `gs://${import.meta.env.VITE_FIREBASE_STORAGE_BUCKET}`)
    : getStorage(app);
};

export const getFileUrl = async (path: string) => {
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, path);
  return await getDownloadURL(storageRef);
};
