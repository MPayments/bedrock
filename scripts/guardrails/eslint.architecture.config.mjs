import tseslint from "typescript-eslint";

const moduleDomainFiles = [
  "packages/modules/*/src/domain/**/*.{ts,tsx,mts,cts}",
  "packages/modules/*/src/**/domain/**/*.{ts,tsx,mts,cts}",
];

const moduleApplicationFiles = [
  "packages/modules/*/src/application/**/*.{ts,tsx,mts,cts}",
  "packages/modules/*/src/**/application/**/*.{ts,tsx,mts,cts}",
];

const moduleApplicationPortFiles = [
  "packages/modules/*/src/application/**/ports.{ts,tsx,mts,cts}",
  "packages/modules/*/src/application/**/ports/**/*.{ts,tsx,mts,cts}",
  "packages/modules/*/src/application/ports/**/*.{ts,tsx,mts,cts}",
  "packages/modules/*/src/**/application/**/ports.{ts,tsx,mts,cts}",
  "packages/modules/*/src/**/application/**/ports/**/*.{ts,tsx,mts,cts}",
  "packages/modules/*/src/**/application/ports/**/*.{ts,tsx,mts,cts}",
];

const persistenceImportRestrictions = [
  {
    name: "drizzle-orm",
    message: "Core module layers must not use Drizzle directly.",
  },
  {
    name: "@bedrock/platform/persistence",
    message: "Core module layers must not depend on persistence types.",
  },
  {
    name: "@bedrock/platform/persistence/drizzle",
    message: "Core module layers must not depend on persistence types.",
  },
];

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
    files: moduleDomainFiles,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: persistenceImportRestrictions,
          patterns: [
            {
              group: ["@bedrock/*/queries"],
              message:
                "Module domain code must not depend on cross-context query adapters.",
            },
            {
              group: ["@bedrock/*/schema"],
              message: "Module domain code must not import schema surfaces.",
            },
            {
              group: [
                "**/application",
                "**/application/**",
                "**/adapters",
                "**/adapters/**",
                "**/infra",
                "**/infra/**",
              ],
              message: "Module domain code must depend inward only.",
            },
          ],
        },
      ],
    },
  },
  {
    files: moduleApplicationFiles,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: persistenceImportRestrictions,
          patterns: [
            {
              group: ["@bedrock/*/queries"],
              message:
                "Module application code must depend on ports injected from composition, not cross-context query adapters.",
            },
            {
              group: ["@bedrock/*/schema"],
              message:
                "Module application code must consume query or contract surfaces, not schemas.",
            },
            {
              group: [
                "**/adapters",
                "**/adapters/**",
                "**/infra",
                "**/infra/**",
              ],
              message:
                "Module application code must not import concrete adapters directly.",
            },
          ],
        },
      ],
    },
  },
  {
    files: moduleApplicationPortFiles,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@bedrock/platform/persistence",
              message:
                "Application ports must not expose persistence transaction types.",
            },
            {
              name: "@bedrock/platform/persistence/drizzle",
              message:
                "Application ports must not expose persistence transaction types.",
            },
          ],
          patterns: [
            {
              group: [
                "../schema",
                "../schema/**",
                "../../schema",
                "../../schema/**",
                "../../../schema",
                "../../../schema/**",
                "@bedrock/*/schema",
              ],
              message: "Application ports must not import schema files.",
            },
          ],
        },
      ],
    },
  },
];
