import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import { FlatCompat } from "@eslint/eslintrc";
import typescriptEslint from "typescript-eslint";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**"],
  },
  ...nextCoreWebVitals,
  ...typescriptEslint.configs.recommended,
  ...compat.extends("prettier"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
