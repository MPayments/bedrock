import { config } from "./tooling/eslint-config/backend.js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
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
              message: "Accounting domain must not depend on persistence types.",
            },
            {
              name: "@bedrock/platform/persistence/drizzle",
              message: "Accounting domain must not depend on persistence types.",
            },
          ],
          patterns: [
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
              message: "Accounting application code must not use Drizzle directly.",
            },
            {
              name: "@bedrock/platform/persistence",
              message: "Accounting application code must not depend on persistence types.",
            },
            {
              name: "@bedrock/platform/persistence/drizzle",
              message: "Accounting application code must not depend on persistence types.",
            },
          ],
          patterns: [
            {
              group: ["@bedrock/*/schema"],
              message: "Accounting application code must consume query or contract surfaces, not schemas.",
            },
            {
              group: ["**/infra", "**/infra/**"],
              message: "Accounting application code must not import infra adapters directly.",
            },
          ],
        },
      ],
    },
  },
];
