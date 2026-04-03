import { config } from "./tooling/eslint-config/backend.js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    files: ["**/documents/src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "drizzle-orm",
              message: "Documents domain must stay free of Drizzle.",
            },
            {
              name: "@bedrock/platform/persistence",
              message: "Documents domain must not depend on persistence types.",
            },
            {
              name: "@bedrock/platform/persistence/drizzle",
              message: "Documents domain must not depend on persistence types.",
            },
          ],
          patterns: [
            {
              group: [
                "**/contracts",
                "**/contracts/**",
                "**/application",
                "**/application/**",
                "**/infra",
                "**/infra/**",
              ],
              message: "Documents domain must depend inward only.",
            },
            {
              group: ["@bedrock/*/queries"],
              message:
                "Documents domain must not depend on cross-context query adapters.",
            },
            {
              group: ["@bedrock/*/schema"],
              message: "Documents domain must not import schema surfaces.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/documents/src/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "drizzle-orm",
              message: "Documents application code must not use Drizzle directly.",
            },
            {
              name: "@bedrock/platform/persistence",
              message: "Documents application code must not depend on persistence types.",
            },
            {
              name: "@bedrock/platform/persistence/drizzle",
              message: "Documents application code must not depend on persistence types.",
            },
            {
              name: "@bedrock/platform/idempotency",
              message:
                "Documents application code must depend on local transaction ports, not platform idempotency types.",
            },
          ],
          patterns: [
            {
              group: ["@bedrock/*/queries"],
              message:
                "Documents application code must depend on injected ports, not cross-context query adapters.",
            },
            {
              group: ["@bedrock/*/schema"],
              message:
                "Documents application code must consume contract or port surfaces, not schemas.",
            },
            {
              group: ["**/infra", "**/infra/**"],
              message: "Documents application code must not import infra adapters directly.",
            },
          ],
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
              message: "Accounting domain must not depend on persistence types.",
            },
            {
              name: "@bedrock/platform/persistence/drizzle",
              message: "Accounting domain must not depend on persistence types.",
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
              group: ["@bedrock/*/queries"],
              message:
                "Accounting application code must depend on ports injected from composition, not cross-context query adapters.",
            },
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
