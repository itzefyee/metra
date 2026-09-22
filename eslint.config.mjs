import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local agent worktrees, generated Convex bindings, and the standalone
    // MCP package are not part of the web-app lint target.
    ".kilo/**",
    "convex/_generated/**",
    "my-mcp-server/**",
    "scripts/**",
  ]),
  // This is an existing prototype being migrated incrementally. Keep these
  // findings visible without blocking the deployable static application;
  // strict TypeScript compilation remains required by `npm run build`.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
