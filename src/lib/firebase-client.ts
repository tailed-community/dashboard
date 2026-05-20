import { getApps, getApp, initializeApp } from "@firebase/app";
import { connectStorageEmulator, getDownloadURL, getStorage, ref } from "firebase/storage";

let storageEmulatorConnected = false;

function getFirebaseApp() {
  if (!getApps().length) {
    return initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });
  }

  return getApp();
}

export function FirebaseClient() {
  getFirebaseApp();
  return null;
}

// Get Firebase Storage instance
export const getFirebaseStorage = () => {
  const app = getFirebaseApp();
  const storage = import.meta.env.DEV
    ? getStorage(app, `gs://${import.meta.env.VITE_FIREBASE_STORAGE_BUCKET}`)
    : getStorage(app);

  if (
    import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true" &&
    !storageEmulatorConnected
  ) {
    connectStorageEmulator(storage, "127.0.0.1", 9200);
    storageEmulatorConnected = true;
  }

  return storage;
};


export const getFileUrl = async (path: string) => {
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, path);
  return await getDownloadURL(storageRef);
};
