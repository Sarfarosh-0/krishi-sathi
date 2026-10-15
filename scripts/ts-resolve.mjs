import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Node ESM resolve hook for the retrieval tests.
 *
 * App code uses extensionless TypeScript imports (`import { x } from "./y"`),
 * which is the Next.js convention, but Node's ESM resolver requires an explicit
 * file extension. This hook retries a relative specifier with ".ts" appended and
 * hands the result back to Node's default resolver, so no build step and no
 * extra dependency is needed to run the real modules under `node:test`.
 *
 * Registered from scripts/test-retrieval.mjs — never used by the app.
 */
export async function resolve(specifier, context, nextResolve) {
  const isRelative = specifier.startsWith(".");
  const hasExtension = /\.(ts|tsx|js|mjs|cjs|json)$/.test(specifier);

  if (isRelative && !hasExtension) {
    for (const extension of [".ts", ".json"]) {
      const candidate = new URL(specifier + extension, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(specifier + extension, context);
      }
    }
  }

  return nextResolve(specifier, context);
}
