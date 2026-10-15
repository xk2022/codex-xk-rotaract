import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// @ts-expect-error Node built-ins are used only by the Vite config runtime.
import { readFileSync } from "node:fs";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    base: "./",
    plugins: [react(), tailwindcss()],
    server: {
      ...(env.DEV_TLS_KEY && env.DEV_TLS_CERT
        ? {
            https: {
              key: readFileSync(env.DEV_TLS_KEY),
              cert: readFileSync(env.DEV_TLS_CERT),
            },
          }
        : {}),
      ...(env.VITE_API_MODE === "live"
        ? {
            proxy: {
              "/api": {
                target: env.DEV_API_TARGET || "http://localhost:8080",
                changeOrigin: false,
              },
            },
          }
        : {}),
    },
  };
});
