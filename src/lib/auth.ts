import { getApp, getApps, initializeApp } from "@firebase/app";
import {
  getAuth,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  isSignInWithEmailLink,
  GithubAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously as firebaseSignInAnonymously,
  connectAuthEmulator,
} from "firebase/auth";

if (!getApps().length) {
  initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
}

const app = getApp();

export const TENANT_IDS = import.meta.env.DEV
  ? ({
      STUDENTS: "students-dev-e3eo3",
    } as const)
  : ({
      STUDENTS: "students-hactj",
    } as const);

export const getAuthForTenant = (tenantId: string) => {
  const auth = getAuth(app);

  if (import.meta.env.VITE_FIREBASE_PROJECT_ID?.startsWith("demo-")) {
    // Connect to the emulator
    connectAuthEmulator(auth, "http://localhost:9099");
  }
  auth.tenantId = tenantId;
  return auth;
};

export const sendLoginLink = async (
  email: string,
  tenantId = TENANT_IDS.STUDENTS,
) => {
  const actionCodeSettings = {
    url: `${window.location.origin}/auth/callback?tenantId=${tenantId}`, // Include tenantId in redirect URL
    handleCodeInApp: true,
    linkDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  };

  const auth = getAuthForTenant(tenantId);
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  localStorage.setItem("emailForSignIn", email); // Store email temporarily
  localStorage.setItem("tenantIdForSignIn", tenantId); // Store tenantId for later
};

export const completeSignIn = async () => {
  if (isSignInWithEmailLink(studentAuth, window.location.href)) {
    const email =
      localStorage.getItem("emailForSignIn") ||
      window.prompt("Enter your email:");
    if (!email) throw new Error("Email is required");

    // Extract tenantId from the URL
    const url = new URL(window.location.href);
    const tenantId = url.searchParams.get("tenantId");

    // Create a new auth instance with the exact tenantId from the URL
    const auth = tenantId ? getAuthForTenant(tenantId) : studentAuth;

    const userCredential = await signInWithEmailLink(
      auth,
      email,
      window.location.href,
    );
    localStorage.removeItem("emailForSignIn");

    const user = userCredential.user;

    return user;
  }
  return null;
};

/**
 * Initializes an anonymous student session if none exists
 * @returns The current user object
 */
export const initializeStudentSession = async () => {
  try {
    // Check if we already have a user (anonymous or authenticated)
    if (!studentAuth.currentUser) {
      await firebaseSignInAnonymously(studentAuth);
      console.log("Anonymous session created");
    }
    return studentAuth.currentUser;
  } catch (error) {
    console.error("Error initializing student session:", error);
    throw error;
  }
};

/**
 * Checks if the current user is anonymous
 * @returns Boolean indicating if the user is anonymous
 */
export const isAnonymousUser = () => {
  return studentAuth.currentUser?.isAnonymous || false;
};

export const signInWithGithub = async () => {
  const provider = new GithubAuthProvider();

  // Add required scopes for retrieving user data
  provider.addScope("read:user");
  provider.addScope("repo");
  provider.addScope("read:org");

  // provider.setCustomParameters({
  //   'auth_domain': import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // });

  try {
    // If we have an anonymous user, try to link with GitHub
    if (studentAuth.currentUser?.isAnonymous) {
      const result = await signInWithPopup(studentAuth, provider);
      const credential = GithubAuthProvider.credentialFromResult(result);

      // Link the GitHub credential to the anonymous account
      // if (credential && studentAuth.currentUser) {
      //   await linkWithCredential(studentAuth.currentUser, credential);
      // }

      return {
        user: result.user,
        token: credential?.accessToken,
      };
    } else {
      // Regular sign in with GitHub if not anonymous
      const result = await signInWithPopup(studentAuth, provider);
      const credential = GithubAuthProvider.credentialFromResult(result);

      return {
        user: result.user,
        token: credential?.accessToken,
      };
    }
  } catch (error) {
    console.error("GitHub auth error:", error);
    throw error;
  }
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();

  // Add required scopes for retrieving user data
  provider.addScope("https://www.googleapis.com/auth/userinfo.email");
  provider.addScope("https://www.googleapis.com/auth/userinfo.profile");

  // provider.setCustomParameters({
  //   'auth_domain': import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // });

  try {
    // If we have an anonymous user, try to link with Google
    if (studentAuth.currentUser?.isAnonymous) {
      const result = await signInWithPopup(studentAuth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      return {
        user: result.user,
        token: credential?.accessToken,
      };
    } else {
      // Regular sign in with Google if not anonymous
      const result = await signInWithPopup(studentAuth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      return {
        user: result.user,
        token: credential?.accessToken,
      };
    }
  } catch (error) {
    console.error("Google auth error:", error);
    throw error;
  }
};

export const orgAuth = getAuthForTenant(TENANT_IDS.ORGANIZATIONS);
export const studentAuth = getAuthForTenant(TENANT_IDS.STUDENTS);
