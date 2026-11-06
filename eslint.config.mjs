import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // These files execute as CommonJS under Node; require is their native syntax.
    files: ["**/*.cjs", "*.js", "scripts/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local archives and generated evidence are not application source or deployments.
    "docs/**",
    "scratch/**",
    "output/**",
    "outputs/**",
    "CTT API/**",
    "correos api/**",
  ]),
]);

export default eslintConfig;
