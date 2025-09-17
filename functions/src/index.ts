import { onRequest } from "firebase-functions/v2/https";
import { decodedToken } from "./lib/firebase";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth";
import profileRouter from "./routes/profile";
import githubRouter from "./routes/github";
import devpostRouter from "./routes/devpost";
import jobRouter from "./routes/job";

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
app.use("/profile", decodedToken(), profileRouter);
app.use("/github", decodedToken(), githubRouter);
app.use("/devpost", decodedToken(), devpostRouter);
app.use("/job", decodedToken(), jobRouter);

exports.app = onRequest({ cors: true }, app);
