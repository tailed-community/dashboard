import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./lib/auth-provider.tsx";
import { FirebaseClient } from "./lib/firebase-client.ts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FirebaseClient />
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);

export default App;
