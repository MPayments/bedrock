import js from "@eslint/js";
import { SourceCode } from "eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import securityPlugin from "eslint-plugin-security";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";

// eslint-plugin-import still calls pre-ESLint-10 SourceCode helpers.
if (typeof SourceCode.prototype.getTokenOrCommentBefore !== "function") {
  SourceCode.prototype.getTokenOrCommentBefore = function (node) {
    return this.getTokenBefore(node, { includeComments: true });
  };
}

if (typeof SourceCode.prototype.getTokenOrCommentAfter !== "function") {
  SourceCode.prototype.getTokenOrCommentAfter = function (node) {
    return this.getTokenAfter(node, { includeComments: true });
  };
}

/**
 * Stricter backend-focused ESLint config for Node/TypeScript services.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  eslintConfigPrettier,
  {
    plugins: {
      import: importPlugin,
      security: securityPlugin,
      turbo: turboPlugin,
    },
    settings: {
      "import/internal-regex": "^@bedrock/",
    },
    rules: {
      "turbo/no-undeclared-env-vars": "error",
      "curly": ["error", "multi-line"],
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "object-shorthand": "error",
      "import/order": [
        "error",
        {
          groups: [["builtin", "external"], ["internal"], ["parent", "sibling", "index"]],
          pathGroups: [
            {
              pattern: "@bedrock/**",
              group: "internal",
              position: "after",
            },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],
      "@typescript-eslint/consistent-type-definitions": "error",
      "@typescript-eslint/array-type": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "security/detect-bidi-characters": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-new-buffer": "error",
      "security/detect-unsafe-regex": "error",
    },
  },
  {
    ignores: ["dist/**", "coverage/**"],
  },
];
