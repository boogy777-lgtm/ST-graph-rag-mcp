import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Vite config for the bundled dashboard.
 *
 * Output:
 *   - All assets land in `<src/uiRoot>/dist/`
 *   - Paths in index.html are RELATIVE (`./assets/...`) so the SPA works
 *     when loaded over `http://127.0.0.1:<random>/` with no trailing slash.
 *
 * The dist/ directory is later embedded into the MCP binary via:
 *   bun build --compile --asset ./src/ui/dist=./ui src/index.ts
 *
 * At runtime the WS server serves files via `Bun.file('./ui/...')`.
 */

// `vite.config.ts` is executed by Vite (not Bun), so `import.meta.dirname` is
// not reliably available — derive it from the file URL instead.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
	plugins: [react()],
	root: __dirname,
	base: "./",
	outDir: resolve(__dirname, "dist"),
	assetsDir: "assets",
	emptyOutDir: true,
	clearScreen: false,
	mode: "production",
	server: {
		port: 5173,
		strictPort: false,
	},
	build: {
		target: "es2022",
		sourcemap: false,
		cssMinify: true,
		minify: "esbuild",
		chunkSizeWarningLimit: 2000,
		rollupOptions: {
			output: {
				// Predictable file names → easy to map when debugging.
				entryFileNames: "assets/[name]-[hash].js",
				chunkFileNames: "assets/[name]-[hash].js",
				assetFileNames: "assets/[name]-[hash][extname]",
			},
		},
	},
	esbuild: {
		// Constrain esbuild's parser to a target it recognizes regardless
		// of the parent tsconfig.json (which targets ES2024 — unknown to
		// esbuild ≤0.25, hence the "Unrecognized target environment" warning).
		target: "es2022",
		// Override TS settings inherited from the parent tsconfig.json so
		// esbuild does not parse the parent's "ES2024" target.
		tsconfigRaw: {
			compilerOptions: {
				target: "es2022",
			},
		},
	},
});
