import { onRequest } from "firebase-functions/https";
import { verifyAuth } from "./lib/firebase";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth";
import profileRouter from "./routes/profile";

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
      };
    }
  }
}

const app = express();
const _cors = cors({ origin: true });

app.use(_cors);
app.use(cookieParser());

//Routes
app.use("/auth", authRouter);
app.use("/profile", verifyAuth(), profileRouter);

exports.app = onRequest({ cors: true }, app);
