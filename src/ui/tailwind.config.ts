/**
 * Tailwind v4 configuration (CSS-first).
 *
 * In Tailwind v4 the `tailwind.config.js` is OPTIONAL — the canonical
 * source of truth is the `@theme` block in CSS. We still keep a minimal
 * config file for IDE support and explicit content scanning, but the
 * real design tokens live below in `index.css`.
 */
import type { Config } from "tailwindcss";

const config: Config = {
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
	theme: {
		extend: {},
	},
	plugins: [],
};

export default config;
