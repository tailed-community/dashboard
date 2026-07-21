import admin from "firebase-admin";
import dotenv from "dotenv";
import { getFirestore } from "firebase-admin/firestore";
import type { Request, Response, NextFunction } from "express";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.FB_API_KEY,
  authDomain: process.env.FB_AUTH_DOMAIN,
  projectId: process.env.FB_PROJECT_ID,
  storageBucket: process.env.FB_STORAGE_BUCKET,
  messagingSenderId: process.env.FB_MESSAGING_SENDER_ID,
  appId: process.env.FB_APP_ID,
};

if (!admin.apps.length) {
  admin.initializeApp(firebaseConfig);
}

export const auth = admin.auth();

/**
 * @deprecated Use `auth` directly.
 *
 * This project does not use Firebase Auth multi-tenancy. `FB_TENANT_ID` was
 * never set in any deployed environment, so `createTenantAuth` always fell
 * through to the default auth pool and every user lives there. The tenant
 * scaffolding was actively harmful: it serialized the literal string
 * "undefined" into magic-link continue URLs (via the module-load ordering trap
 * documented in lib/env.ts), which surfaced to users as
 * "That sign-in link has expired".
 *
 * Kept as an alias so the ~8 existing call sites keep working; new code should
 * import `auth`.
 */
export const studentAuth = async () => auth;

export const decodedToken = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];

      if (token) {
        try {
          // If tenantId provided, verify with that tenant's auth
          let tenantAuth = await studentAuth();
          const decodedToken = await tenantAuth.verifyIdToken(token);
          req.user = decodedToken;
        } catch (error) {
          console.error("Error verifying token:", error);
          res.status(401).json({ error: "Invalid token" });
          return;
        }
      }
    }

    next();
  };
};

/**
 * Middleware: requires a valid, authenticated request whose custom claims
 * include `platformAdmin: true`. Must run after `decodedToken()`.
 * 401 if unauthenticated, 403 if authenticated but not a platform admin.
 */
export const requirePlatformAdmin = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.user.platformAdmin !== true) {
      res.status(403).json({ error: "Platform admin access required" });
      return;
    }

    next();
  };
};

export const db = getFirestore();

export const storage = admin.storage();
