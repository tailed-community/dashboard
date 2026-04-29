import admin from "firebase-admin";
import dotenv from "dotenv";
import { getFirestore } from "firebase-admin/firestore";
import type { Request, Response, NextFunction } from "express";

dotenv.config();

const isDev = process.env.NODE_ENV === "development";

if (isDev) {
  process.env.GCLOUD_PROJECT ??= process.env.FB_PROJECT_ID ?? "tailed-community-dev";
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8081";
  } else if (process.env.FIRESTORE_EMULATOR_HOST.startsWith("0.0.0.0:")) {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST.replace("0.0.0.0:", "127.0.0.1:");
  }

  if (process.env.FIREBASE_AUTH_EMULATOR_HOST?.startsWith("0.0.0.0:")) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST =
      process.env.FIREBASE_AUTH_EMULATOR_HOST.replace("0.0.0.0:", "127.0.0.1:");
  }

  if (process.env.FIREBASE_STORAGE_EMULATOR_HOST?.startsWith("0.0.0.0:")) {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST =
      process.env.FIREBASE_STORAGE_EMULATOR_HOST.replace("0.0.0.0:", "127.0.0.1:");
  }
}

const app =
  admin.apps[0] ??
  admin.initializeApp({
    projectId: process.env.FB_PROJECT_ID,
    storageBucket: process.env.FB_STORAGE_BUCKET,
  });

const tenantManager = admin.auth(app).tenantManager();
const STUDENT_TENANT_ID = process.env.FB_TENANT_ID || "";

export const auth = admin.auth(app); // Default auth without tenant

export const createTenantAuth = async (tenantId: string) => {
  if (!tenantId) {
    return auth; // Return default auth if no tenantId
  }
  return tenantManager.authForTenant(tenantId);
};

export const studentAuth = async () => createTenantAuth(STUDENT_TENANT_ID);

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
        }
      }
    }

    next();
  };
};

export const db = getFirestore();

export const storage = admin.storage(app);
