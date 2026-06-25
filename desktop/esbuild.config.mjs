/**
 * Bundle all workspace TypeScript packages. Only native/compiled npm packages
 * stay external. Everything else is inlined.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const bundlePaths = [
  "server",
  "packages/db", "packages/shared", "packages/adapter-utils",
  "packages/adapters/claude-local", "packages/adapters/codex-local",
  "packages/adapters/cursor-local", "packages/adapters/cursor-cloud",
  "packages/adapters/gemini-local", "packages/adapters/grok-local",
  "packages/adapters/openclaw-gateway", "packages/adapters/opencode-local",
  "packages/adapters/pi-local", "packages/adapters/acpx-local",
  "packages/plugins/sdk", "packages/plugins/plugin-llm-wiki",
  "packages/skills-catalog",
];

// Must stay external
const forceExternal = [
  "embedded-postgres", "sharp", "@img/sharp-libvips", "@img/sharp-libvips-dev",
  "@cursor/sdk", "@connectrpc/connect-node",
  "@opentelemetry/*",
  "hermes-paperclip-adapter",
  "bun:sqlite",
];

// Must be bundled (overrides forceExternal and dep scanning)
const forceBundle = new Set(["pino-pretty", "colorette"]);

// Collect npm deps from workspace packages
const externals = new Set(forceExternal);
for (const p of bundlePaths) {
  try {
    const pkg = JSON.parse(readFileSync(resolve(repoRoot, p, "package.json"), "utf8"));
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) {
      if (!name.startsWith("@paperclipai/") && !forceBundle.has(name)) {
        externals.add(name);
      }
    }
  } catch { /* skip */ }
}

console.log(`Bundling ${bundlePaths.length} workspace packages (${externals.size} externals)`);

const result = await esbuild.build({
  entryPoints: [resolve(repoRoot, "server", "src", "index.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "server-bundle.js",
  banner: { js: "// Paperclip Desktop server bundle\n" },
  external: [...externals],
  treeShaking: true,
  sourcemap: "linked",
  resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  loader: { ".d.ts": "empty", ".d.ts.map": "empty", ".node": "copy" },
  logLevel: "warning",
});

const sizeMB = (readFileSync("server-bundle.js").length / (1024 * 1024)).toFixed(2);
console.log(`Bundle: server-bundle.js (${sizeMB} MB)`);
