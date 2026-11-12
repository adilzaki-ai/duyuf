import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [".", "../sample", "../backend/api"] } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    /* Screen tests assert against the sample, never whatever a local API holds today. */
    env: { VITE_DATA_SOURCE: "mock", VITE_DUYUF_API_URL: "", VITE_DUYUF_API_KEY: "" },
  },
});
