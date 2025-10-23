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

const _cors = cors({ origin: true });

const app = express();

app.use(_cors);
app.use(cookieParser());

// Don't use express.json() globally - apply conditionally
// For multipart/form-data routes, we need the raw body stream
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  
  // Skip body parsing for multipart/form-data
  if (contentType.includes('multipart/form-data')) {
    return next();
  }
  
  // Apply JSON parsing for everything else
  express.json()(req, res, next);
});

//Routes
app.use("/auth", authRouter);
app.use("/profile", decodedToken(), profileRouter);
app.use("/github", decodedToken(), githubRouter);
app.use("/devpost", decodedToken(), devpostRouter);
app.use("/job", decodedToken(), jobRouter);

if (process.env.NODE_ENV === "development") {
  // In development, we can add a simple health check endpoint
  app.listen(3001, () => {
    console.log("Development server running on http://localhost:3001");
  });
}

exports.app = onRequest({ cors: true }, app);
