import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
    ],
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  {
    files: ["**/*.{ts,tsx,mts,cts,js,mjs,cjs}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    ignores: [
      "**/src/schema.ts",
      "**/src/**/schema.ts",
      "**/src/**/schema/**/*.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='pgTable']",
          message: "pgTable declarations must live in schema files.",
        },
      ],
    },
  },
  {
    files: ["**/accounting/src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "drizzle-orm",
              message: "Accounting domain must stay free of Drizzle.",
            },
            {
              name: "@bedrock/platform/persistence",
              message:
                "Accounting domain must not depend on persistence types.",
            },
            {
              name: "@bedrock/platform/persistence/drizzle",
              message:
                "Accounting domain must not depend on persistence types.",
            },
          ],
          patterns: [
            {
              group: ["@bedrock/*/queries"],
              message:
                "Accounting domain must not depend on cross-context query adapters.",
            },
            {
              group: ["@bedrock/*/schema"],
              message: "Accounting domain must not import schema surfaces.",
            },
            {
              group: [
                "**/contracts",
                "**/contracts/**",
                "**/application",
                "**/application/**",
                "**/infra",
                "**/infra/**",
              ],
              message: "Accounting domain must depend inward only.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/accounting/src/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "drizzle-orm",
              message:
                "Accounting application code must not use Drizzle directly.",
            },
            {
              name: "@bedrock/platform/persistence",
              message:
                "Accounting application code must not depend on persistence types.",
            },
            {
              name: "@bedrock/platform/persistence/drizzle",
              message:
                "Accounting application code must not depend on persistence types.",
            },
          ],
          patterns: [
            {
              group: ["@bedrock/*/queries"],
              message:
                "Accounting application code must depend on ports injected from composition, not cross-context query adapters.",
            },
            {
              group: ["@bedrock/*/schema"],
              message:
                "Accounting application code must consume query or contract surfaces, not schemas.",
            },
            {
              group: ["**/infra", "**/infra/**"],
              message:
                "Accounting application code must not import infra adapters directly.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/accounting/src/application/**/ports.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "../schema",
                "../schema/**",
                "../../schema",
                "../../schema/**",
              ],
              message: "Accounting ports must not import schema files.",
            },
          ],
        },
      ],
    },
  },
];
