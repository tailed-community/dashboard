import { getApp, getApps, initializeApp } from "@firebase/app";
import {
  getAuth,
  signInWithEmailLink,
  isSignInWithEmailLink,
  GithubAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
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

/**
 * The single auth instance for the app.
 *
 * This project does NOT use Firebase Auth multi-tenancy — every user lives in
 * the project's default pool. `tenantId` is pinned to null rather than left
 * untouched, because `getAuth(app)` is a per-app singleton: a stale tenant set
 * by older code would persist and cause `auth/tenant-id-mismatch` when
 * completing a magic link.
 *
 * `connectAuthEmulator` MUST run here, once, immediately after initializeApp —
 * it throws if the auth instance has already issued a request. It used to be
 * called inside a per-call helper, which was a latent ordering bug.
 */
export const studentAuth = getAuth(app);

if (import.meta.env.VITE_USE_EMULATORS === "true") {
  connectAuthEmulator(studentAuth, "http://localhost:9100", {
    disableWarnings: true,
  });
}

studentAuth.tenantId = null;

/**
 * Requests a passwordless sign-in link. The link is generated and emailed by our
 * backend (`POST /auth/send-login-link`) using firebase-admin +
 * our own "Warm Community" email template — NOT the Firebase client SDK's
 * `sendSignInLinkToEmail`, which would send Firebase's default template.
 *
 * `redirectUrl` is an in-app path to land on after sign-in (e.g. "/jobs").
 * On failure this throws an object with a `code` field shaped like a Firebase
 * Auth error so the form's existing error handling keeps working.
 */
export const sendLoginLink = async (
  email: string,
  redirectUrl?: string // in-app path to land on after sign-in
) => {
  const apiUrl = import.meta.env.VITE_API_URL;
  const response = await fetch(`${apiUrl}/auth/send-login-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, redirectUrl: redirectUrl || "" }),
  });

  if (!response.ok) {
    // Map to a Firebase-like error code so the form's switch on error.code still
    // surfaces the right toast.
    const code =
      response.status === 429
        ? "auth/too-many-requests"
        : response.status === 400
          ? "auth/invalid-email"
          : "auth/internal-error";
    throw { code, status: response.status };
  }

  // Persist for same-device completion. Cross-device still works: the
  // server-generated link carries the email on its continue URL, which
  // completeSignIn() falls back to when localStorage has no emailForSignIn.
  localStorage.setItem("emailForSignIn", email);
};

export const completeSignIn = async () => {
  if (isSignInWithEmailLink(studentAuth, window.location.href)) {
    // Extract params from the URL. Backend-generated sign-in links (e.g. the
    // job-alert welcome email) embed the email so the flow works cross-device,
    // where localStorage has no `emailForSignIn` from a prior sendLoginLink().
    const url = new URL(window.location.href);
    const emailFromUrl = url.searchParams.get("email");

    const email =
      localStorage.getItem("emailForSignIn") ||
      emailFromUrl ||
      window.prompt("Enter your email:");
    if (!email) throw new Error("Email is required");

    // Legacy links (already sitting in inboxes when tenancy was removed) carry
    // a `tenantId` query param. Older builds stringified an undefined tenant,
    // so that param is typically the literal "undefined" — assigning it would
    // fail with auth/tenant-id-mismatch. Every link, old or new, completes
    // against the default pool, so the param is deliberately ignored and the
    // tenant re-cleared in case anything mutated the singleton.
    studentAuth.tenantId = null;

    const userCredential = await signInWithEmailLink(
      studentAuth,
      email,
      window.location.href
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
  // provider.addScope("repo");
  // provider.addScope("read:org");

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

export const signInWithGoogleCredential = async (props: any) => {
  const provider = new GoogleAuthProvider();
  provider.addScope("https://www.googleapis.com/auth/userinfo.email");
  provider.addScope("https://www.googleapis.com/auth/userinfo.profile");

  try {
    const credential = GoogleAuthProvider.credential(props.accessToken);

    // If we have an anonymous user, try to link with Google
    if (studentAuth.currentUser?.isAnonymous) {
      const result = await signInWithCredential(studentAuth, credential);

      return {
        user: result.user,
        token: credential?.accessToken,
      };
    } else {
      // Regular sign in with Google if not anonymous
      const result = await signInWithPopup(studentAuth, provider);

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
