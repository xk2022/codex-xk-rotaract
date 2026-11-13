import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default defineConfig((configEnv) =>
  mergeConfig(viteConfig(configEnv), {
    test: {
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/**/*.d.ts"],
        reporter: ["text", "html", "lcov"],
        reportsDirectory: "coverage",
      },
    },
  }),
);
