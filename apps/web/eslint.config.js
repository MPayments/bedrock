import { nextJsConfig } from "@bedrock/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
  {
    files: [
      "features/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "config/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/app/**",
                "./app/**",
                "../app/**",
                "../../app/**",
                "../../../app/**",
                "../../../../app/**",
                "../../../../../app/**",
                "../../../../../../app/**",
                "../../../../../../../app/**",
              ],
              message:
                "Import reusable logic from feature modules instead of app route files.",
            },
          ],
        },
      ],
    },
  },
];
