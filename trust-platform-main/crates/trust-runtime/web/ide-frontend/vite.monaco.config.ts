import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: resolve(__dirname, "../../src/web/ui/assets"),
    emptyOutDir: false,
    sourcemap: false,
    target: "es2020",
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, "src/monaco-bundle.ts"),
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        entryFileNames: "ide-monaco.20260215.js",
        assetFileNames: "ide-monaco.20260215.[ext]",
        inlineDynamicImports: true,
      },
    },
  },
});
