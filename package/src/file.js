const fs = require("fs")
const path = require("path")

const env = function (project = "dashboard", values = {}) {
  const functionsDefaults = {
    NODE_ENV: "development",
    FB_API_KEY: "dev.community.tailed.ca",
    FB_PROJECT_ID: "tailed-community-dev",
    FB_STORAGE_BUCKET: "tailed-community-dev-bucket",
    FB_TENANT_ID: "",
    EMAIL_SERVER: "smtp://127.0.0.1:1025",
    FRONTEND_URL: "http://localhost:5174",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8081",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9100",
    FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9200",
  };

  const appDefaults = {
    VITE_FIREBASE_API_KEY: "dev-local-key",
    VITE_FIREBASE_PROJECT_ID: "tailed-community-dev",
    VITE_FIREBASE_STORAGE_BUCKET: "tailed-community-dev-bucket",
    VITE_FIREBASE_AUTH_DOMAIN: "localhost",
    VITE_API_URL: "http://localhost:3001",
    VITE_COMPANIES_API_URL: "http://localhost:3001",
    VITE_TENANT_ID: "",
    VITE_USE_FIREBASE_EMULATORS: "true",
    VITE_AUTH_EMULATOR_HOST: "127.0.0.1:9100",
  };

  const appValues = { ...appDefaults, ...(values.app || {}) };
  const functionValues = { ...functionsDefaults, ...(values.functions || {}) };

  const appContent = Object.entries(appValues)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const functionContent = Object.entries(functionValues)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const target = path.join(process.cwd(), project);
  const appPath = path.join(target, ".env");
  const functionsDir = path.join(target, "functions");
  const functionPath = path.join(functionsDir, ".env");

  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(appPath, appContent, "utf8");

  fs.mkdirSync(functionsDir, { recursive: true });
  fs.writeFileSync(functionPath, functionContent, "utf8");

  return { appPath, functionPath };
};



module.exports = {
    env
}
