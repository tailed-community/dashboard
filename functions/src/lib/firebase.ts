import admin from "firebase-admin";
import dotenv from "dotenv";
import { getFirestore } from "firebase-admin/firestore";
import { TENANT_IDS } from "../routes/auth";

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
  return tenantManager.authForTenant(tenantId);
};

export const studentAuth = async () => createTenantAuth(TENANT_IDS.STUDENTS);

export const verifyAuth = (tenant?: "student" | "org") => {
  return async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid bearer token in authorization header");
      return res
        .status(401)
        .json({ error: "Unauthorized - Missing or invalid bearer token" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      console.error("No token provided in authorization header");
      return res
        .status(401)
        .json({ error: "Unauthorized - Token not provided" });
    }

    try {
      // If tenantId provided, verify with that tenant's auth
      let tenantAuth = await studentAuth();
      const decodedToken = await tenantAuth.verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error("Error verifying token:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  };
};

export const db = getFirestore();

export const storage = admin.storage().bucket();
