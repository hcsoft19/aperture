import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "sharp"],
  turbopack: {
    resolveAlias: {
      sharp: { browser: "./src/lib/browser-stub.ts" },
      "onnxruntime-node": { browser: "./src/lib/browser-stub.ts" },
    },
    root: projectRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
