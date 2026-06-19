import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: resolve(__dirname, "../../src/web/ui/assets"),
    emptyOutDir: false,
    sourcemap: false,
    target: "es2020",
    lib: {
      entry: resolve(__dirname, "src/codemirror-bundle.ts"),
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        entryFileNames: "ide-codemirror.20260215.js",
        inlineDynamicImports: true,
      },
    },
  },
});
