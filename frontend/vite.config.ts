import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/*
 * Port 5180 and an API on 8100, so Duyuf runs beside Sky Logics (5173 / 8000).
 *
 * The API stays on 127.0.0.1 and is reached through this proxy: the app calls
 * its own origin ("/v1/…"), so no CORS origin has to be opened and a phone on
 * the same wifi works through the dev server. Pair with VITE_DUYUF_API_URL=/.
 *
 * `../sample` is the demo both halves share (sample/demo.json); the sample
 * mode imports it directly.
 */
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? "/",
  server: {
    host: true,
    port: 5180,
    strictPort: true,
    proxy: { "/v1": { target: "http://127.0.0.1:8100", changeOrigin: false } },
    fs: { allow: [".", "../sample"] },
  },
  build: { sourcemap: true },
});
