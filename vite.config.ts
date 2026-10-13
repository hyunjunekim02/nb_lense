/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the site under /<repo>/
export default defineConfig({
  base: "/nb_lense/",
  plugins: [react()],
  build: {
    target: ["es2020", "safari16"],
  },
  test: {
    environment: "node",
  },
});
