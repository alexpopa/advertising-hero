import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // MapLibre 6 loads its worker from a file next to itself; Vite's dependency
  // pre-bundling moves the library and breaks that path, so serve it as-is.
  optimizeDeps: { exclude: ["maplibre-gl"] },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
