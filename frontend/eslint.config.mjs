import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config({
  files: ["src/**/*.{ts,tsx}"],
  extends: [js.configs.recommended, ...tseslint.configs.recommended],
});
