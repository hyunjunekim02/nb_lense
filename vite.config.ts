/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the site under /<repo>/
export default defineConfig({
  base: "/nb_lense/",
  plugins: [react()],
  server: {
    // npm run dev 하면 브라우저가 /nb_lense/ 경로로 바로 열린다
    open: true,
  },
  build: {
    target: ["es2020", "safari16"],
  },
  test: {
    environment: "node",
  },
});
