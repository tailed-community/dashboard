import admin from "firebase-admin";
import dotenv from "dotenv";
import { getFirestore } from "firebase-admin/firestore";
import { TENANT_IDS } from "../routes/auth";
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

const tenantManager = admin.auth().tenantManager();

export const auth = admin.auth(); // Default auth without tenant

export const createTenantAuth = async (tenantId: string) => {
  if (!tenantId) {
    return auth; // Return default auth if no tenantId
  }
  return tenantManager.authForTenant(tenantId);
};

export const studentAuth = async () => createTenantAuth(TENANT_IDS.STUDENTS);

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

export const storage = admin.storage();
