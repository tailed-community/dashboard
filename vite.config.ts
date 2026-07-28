import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { prerenderPlugin } from "./plugins/prerender";

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5174,
    // Share links are served by the API but live on the SITE's domain, via the
    // Firebase Hosting rewrites in firebase.json. Proxying the same two paths
    // in dev makes a copied link work locally instead of falling through to
    // the SPA's not-found page.
    //
    // The keys MUST stay anchored regexes (a leading `^` makes Vite treat the
    // key as a RegExp). A plain "/s" is a prefix match, which also captures
    // /src/main.tsx — and "/f" captures /favicon.ico — proxying the app's own
    // entry point to the API and leaving the page blank.
    proxy: {
      "^/s/[^/]+$": {
        target: process.env.VITE_API_URL || "http://localhost:3001",
        changeOrigin: true,
      },
      "^/f/[^/]+$": {
        target: process.env.VITE_API_URL || "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
    }),
    react(),
    tailwindcss(),
    prerenderPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
