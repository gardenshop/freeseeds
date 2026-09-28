import tseslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";
import { globalIgnores } from "eslint/config";

export default [globalIgnores([".kilo/**", "node_modules/**", ".wrangler/**"]), {
  files: ["**/*.ts"],
  languageOptions: { parser, parserOptions: { project: "./tsconfig.json" } },
  plugins: { "@typescript-eslint": tseslint },
  rules: { "@typescript-eslint/no-explicit-any": "error", "no-console": "error" }
}];
