import { nextJsConfig } from "@bedrock/eslint-config/next-js";
import { clientReachableCommonImportPaths } from "@bedrock/eslint-config/client-reachable";

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
          paths: clientReachableCommonImportPaths,
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
