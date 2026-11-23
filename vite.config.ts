import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // MapLibre 6 loads its worker from a file next to itself; Vite's dependency
  // pre-bundling moves the library and breaks that path, so serve it as-is.
  optimizeDeps: { exclude: ["maplibre-gl"] },
  // Fixed ports so this never takes another local project's port (5173 is a common default).
  // ".ts.net" lets the dev server be opened through a Tailscale Serve link.
  server: { host: "127.0.0.1", port: 5174, strictPort: true, allowedHosts: [".ts.net"] },
  preview: { port: 4174, strictPort: true },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
