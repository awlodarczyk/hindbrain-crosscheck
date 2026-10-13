import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  {
    ignores: [
      ".next/**",
      ".next-hosted/**",
      ".next-*/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
      "factcheck-duo/**",
      "designs/**",
      "docs/**",
      "plans/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-param-reassign": "error",
      "prefer-const": "error",
    },
  },
];

export default config;
