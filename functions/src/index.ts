import { onRequest } from "firebase-functions/v2/https";
import { decodedToken } from "./lib/firebase";
import { appEnv, assertEnvValid, isStandalone } from "./lib/env";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth";
import profileRouter from "./routes/profile";
import githubRouter from "./routes/github";
import devpostRouter from "./routes/devpost";
import jobRouter from "./routes/job";
import eventRouter from "./routes/event";
import communityRouter from "./routes/community";
import adminRouter from "./routes/admin";
import publicRouter from "./routes/public";
import alertsRouter from "./routes/alerts";
import surveysRouter from "./routes/surveys";
import { jobsDigest } from "./scheduled/jobs-digest";
import { onboardingEmails } from "./scheduled/onboarding-emails";

declare global {
  namespace Express {
    interface Request {
      // Assigned from the full Firebase DecodedIdToken by decodedToken()
      // (see lib/firebase.ts). Widened with an index signature so custom
      // claims (e.g. `platformAdmin`) are readable without re-declaring
      // every claim we use.
      user?: {
        uid: string;
        email?: string;
        platformAdmin?: boolean;
      } & Record<string, unknown>;
      rawBody?: Buffer; // For Firebase Functions multipart/form-data
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

// Apply authentication middleware globally
// If a Bearer token is present, it will decode and set req.user
// If no token or invalid token, req.user will be undefined
app.use(decodedToken());

//Routes
app.use("/auth", authRouter);
app.use("/public", publicRouter); // Public routes (no auth required)
app.use("/profile", profileRouter);
app.use("/github", githubRouter);
app.use("/devpost", devpostRouter);
app.use("/job", jobRouter);
app.use("/events", eventRouter);
app.use("/communities", communityRouter);
app.use("/admin", adminRouter);
app.use("/alerts", alertsRouter);
app.use("/surveys", surveysRouter);

// Validate configuration at load time so a misconfigured environment fails
// immediately and visibly, rather than as a mysterious 500 on the first
// sign-in attempt. Also logs the resolved environment, which is the fastest
// way to answer "which project am I actually talking to?".
assertEnvValid();

// Standalone Express listener for local development (what VITE_API_URL points
// at).
//
// Gated on the RUNTIME, not on APP_ENV. Only a plain node/nodemon process has
// to serve HTTP itself; the emulator and the deployed Cloud Functions runtime
// both serve the exported `app` for us. Gating this on APP_ENV would either
// miss local-dev (APP_ENV=dev on a laptop) or wrongly bind a port on
// deployed-dev (APP_ENV=dev in the cloud) — the two are only distinguishable
// by runtime. See the two-axis model in lib/env.ts.
if (isStandalone()) {
  const port = Number(process.env.DEV_SERVER_PORT) || 3001;
  const server = app.listen(port, () => {
    console.log(
      `[server] listening on http://localhost:${port} (APP_ENV=${appEnv()})`
    );
  });

  // Without this, a bind failure is an unhandled 'error' event that ends the
  // process with a bare "clean exit" and no explanation. On Windows in
  // particular a stale nodemon child can keep holding the port, so this needs
  // to be loud and actionable.
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[server] port ${port} is already in use — most likely a stale dev ` +
          `server from a previous run.\n` +
          `  Windows: netstat -ano | findstr :${port}   then  taskkill /PID <pid> /F\n` +
          `  macOS/Linux: lsof -ti :${port} | xargs kill -9\n` +
          `  Or set DEV_SERVER_PORT to a different port.`
      );
    } else {
      console.error("[server] failed to start:", err);
    }
    process.exit(1);
  });
}

exports.app = onRequest({ cors: true }, app);
exports.jobsDigest = jobsDigest;
exports.onboardingEmails = onboardingEmails;
